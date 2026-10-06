import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getRoles } from '@/lib/access';
import { getAdminEmails, getEnvVar } from '@/lib/env';

/**
 * Autenticación con la cuenta de Google del invitado o de los novios.
 *
 * El login está abierto: entra cualquier cuenta de Google. Quien figura en
 * `ADMIN_EMAIL` obtiene además el rol `admin` (borrar, descargar, panel); el
 * resto entra como `uploader` y solo sube fotos. La distinción vive en
 * `src/lib/access.ts`, no aquí.
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
 * Alcance solicitado a Google en el login: solo identidad.
 *
 * Antes pedía además `https://www.googleapis.com/auth/drive`, y sobraba. El
 * acceso a Drive no viene de la sesión sino de `GOOGLE_REFRESH_TOKEN` (ver
 * `src/lib/google-drive.ts`), así que ese scope no lo usaba nadie y solo
 * abultaba la pantalla de consentimiento, que es justo lo que asusta a quien va
 * a autorizar por primera vez.
 *
 * Que las fotos ya existentes sigan siendo accesibles tampoco depende de
 * aquí: es cosa del token de refresco, que sí va con `drive` completo porque la
 * galería tiene que leer y borrar archivos anteriores a la aplicación.
 *
 * Los tres scopes OIDC **no son opcionales**: el proveedor de Auth.js es de
 * tipo `oidc` y saca el perfil del usuario del `id_token`. Si `scope` quedara
 * vacío, Google no emitiría `id_token` y el callback `signIn` recibiría
 * `user.email === undefined`, con lo que la cuenta no podría subir fotos ni
 * alcanzar ningún rol.
 *
 * Al definir `scope` a mano se sustituye la lista por defecto del proveedor,
 * de ahí que haya que incluir aquí los scopes OIDC.
 */
const GOOGLE_SCOPES = ['openid', 'email', 'profile'].join(' ');

export const { handlers, signIn, signOut, auth } = NextAuth({
  // `next start` no marca ningún host como de confianza y el login falla con
  // `UntrustedHost`. Vercel y los proxies de producción (Nginx, Caddy) ya
  // reenvían el host original, así que se acepta el que llega en la petición.
  // Alternativa a la variable `AUTH_TRUST_HOST=true`.
  trustHost: true,
  providers: [
    Google({
      // Se leen de `src/lib/env.ts` para que las mismas credenciales sirvan
      // tanto para el login como para las llamadas a Drive, en lugar de
      // depender de las variables `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, y
      // para que el valor salga limpio de comillas y espacios.
      clientId: getEnvVar('GOOGLE_CLIENT_ID'),
      clientSecret: getEnvVar('GOOGLE_CLIENT_SECRET'),
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          // No se piden `access_type=offline` ni `prompt=consent`. El login
          // solo autentica al usuario: el acceso a Drive no viene de la
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
     * Puerta de entrada: entra cualquier cuenta de Google.
     *
     * Aquí no se niega a nadie a propósito; el único requisito es que la
     * cuenta traiga email, que es lo que permite asignarle un rol. Los
     * permisos concretos los aplican `src/lib/access.ts` en cada página y
     * cada ruta: `ADMIN_EMAIL` decide quién es `admin` y el resto son
     * `uploader`, que solo pueden subir fotos.
     *
     * Google ya garantiza que el email viene verificado, así que comparar
     * contra `ADMIN_EMAIL` basta para repartir roles.
     *
     * Si `ADMIN_EMAIL` está sin definir la app sigue abierta —cualquiera
     * sube—, pero no hay nadie que pueda borrar fotos ni descargar la
     * galería entera, así que se avisa por consola: es un síntoma de
     * despliegue a medio configurar, no una decisión del novio.
     */
    async signIn({ user }) {
      const roles = getRoles(user.email);

      if (roles.length === 0) {
        console.warn(
          `[auth] ${user.email ?? 'Una cuenta de Google'} ha entrado sin email: ` +
            'podrá ver la galería, pero no subir fotos.'
        );
        return true;
      }

      console.log(`[auth] Acceso concedido a ${user.email} como ${roles.join(' + ')}.`);

      if (!roles.includes('admin') && getAdminEmails() === null) {
        console.warn(
          '[auth] ADMIN_EMAIL sin definir: entra cualquier cuenta de Google y ' +
            'nadie tiene acceso a /admin (borrado, descarga y panel).'
        );
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
