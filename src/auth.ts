import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Autenticación del panel de administración mediante la cuenta de Google del
 * administrador.
 *
 * Se usa la cuenta real y no una cuenta de servicio porque las fotos se
 * guardan en su Drive: una Service Account no tiene cuota de almacenamiento ni
 * puede ser propietaria de un archivo, por lo que Google rechazaba cada subida.
 *
 * El mismo par `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` se reutiliza en
 * `src/lib/google-drive.ts` para las llamadas a la API, así que solo hay que
 * crear un cliente OAuth en Google Cloud.
 */

/**
 * Alcance solicitado a la API de Drive.
 *
 * Se pide el alcance `drive` completo y no el restringido `drive.file` a
 * propósito: la galería tiene que leer y borrar las fotos que ya había en la
 * carpeta, que son anteriores a la aplicación. `drive.file` solo concede acceso
 * a los ficheros que la propia app crea o abre, así que las fotos antiguas
 * desaparecerían de la galería.
 */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/**
 * Alcance total de la petición a Google.
 *
 * Los tres scopes OIDC **no son opcionales**: el proveedor de Auth.js es de
 * tipo `oidc` y saca el perfil del usuario del `id_token`. Si `scope` solo
 * lleva `drive`, Google no emite `id_token` y el callback `signIn` recibe
 * `user.email === undefined`, así que la comprobación contra `ADMIN_EMAIL`
 * siempre falla y nadie puede entrar.
 *
 * Al definir `scope` a mano se sustituye la lista por defecto del proveedor,
 * de ahí que haya que incluir aquí los scopes OIDC.
 */
const GOOGLE_SCOPES = [DRIVE_SCOPE, 'openid', 'email', 'profile'].join(' ');

export const { handlers, signIn, signOut, auth } = NextAuth({
  // `next start` no marca ningún host como de confianza y el login falla con
  // `UntrustedHost`. Vercel y los proxies de producción (Nginx, Caddy) ya
  // reenvían el host original, así que se acepta el que llega en la petición.
  // Alternativa a la variable `AUTH_TRUST_HOST=true`.
  trustHost: true,
  providers: [
    Google({
      // Se pasan explícitos para que las mismas credenciales sirvan tanto para
      // el login como para las llamadas a Drive, en lugar de depender de las
      // variables `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          // No se piden `access_type=offline` ni `prompt=consent`. El login
          // solo autentica al administrador: el acceso a Drive no viene de la
          // sesión, sino de `GOOGLE_REFRESH_TOKEN` (ver `src/lib/google-drive.ts`),
          // y así no se le obliga a pasar por la pantalla de consentimiento en
          // cada entrada. El refresh token se genera aparte, con
          // `npm run drive:token`.
        },
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
    /**
     * Solo entra la cuenta del administrador. Google ya garantiza que el email
     * de la cuenta está verificado, así que basta con compararlo con
     * `ADMIN_EMAIL`.
     */
    async signIn({ user }) {
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

      if (!adminEmail) {
        console.warn(
          '[auth] ADMIN_EMAIL no está definido: se permite el acceso a cualquier cuenta de Google. ' +
            'Define ADMIN_EMAIL para restringirlo.'
        );
        return true;
      }

      if (user.email?.toLowerCase() !== adminEmail) {
        console.warn(
          `[auth] Acceso denegado a ${user.email ?? 'cuenta desconocida'}: no coincide con ADMIN_EMAIL.`
        );
        return false;
      }

      return true;
    },
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
