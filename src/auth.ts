import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

/**
 * Lee el hash bcrypt del administrador desde `ADMIN_PASSWORD_HASH_B64`.
 *
 * El hash se almacena en Base64 a propósito: Next.js expande `$VARIABLE` al
 * cargar `.env.local`, y un hash bcrypt tiene la forma `$2b$10$<salt><hash>`.
 * Guardado en crudo, la carga resolvería `$2b`, `$10` y `$<salt>` contra
 * variables inexistentes y los borraría, dejando un hash corrupto y un login
 * que falla sin ningún error visible. Base64 no contiene `$`, así que el valor
 * llega intacto.
 */
function getAdminPasswordHash(): string | null {
  const encoded = process.env.ADMIN_PASSWORD_HASH_B64;

  if (!encoded) {
    if (process.env.ADMIN_PASSWORD_HASH) {
      console.warn(
        '[auth] ADMIN_PASSWORD_HASH está definido pero se ignora: los "$" de un hash bcrypt ' +
          'los expande el cargador de Next.js. Usa ADMIN_PASSWORD_HASH_B64.'
      );
    }
    return null;
  }

  const decoded = Buffer.from(encoded.trim(), 'base64').toString('utf8');

  if (!/^\$2[aby]\$\d{2}\$/.test(decoded)) {
    console.warn('[auth] ADMIN_PASSWORD_HASH_B64 no contiene un hash bcrypt válido.');
    return null;
  }

  return decoded;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // `next start` no marca ningún host como de confianza y el login falla con
  // `UntrustedHost`. Vercel y los proxies de producción (Nginx, Caddy) ya
  // reenvían el host original, así que se acepta el que llega en la petición.
  // Alternativa a la variable `AUTH_TRUST_HOST=true`.
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Check against environment variables
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = getAdminPasswordHash();

        if (!adminEmail || !adminPasswordHash) return null;
        if (email.toLowerCase() !== adminEmail.toLowerCase()) return null;

        const passwordMatch = await bcrypt.compare(password, adminPasswordHash);
        if (!passwordMatch) return null;

        return {
          id: '1',
          email: adminEmail,
          name: 'Administrador',
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
