import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/access';
import { ROUTES } from '@/lib/constants';
import { getWeddingConfig } from '@/lib/env';
import LoginForm from './login-form';
import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Acceso',
};

/**
 * Traduce el `error` que Auth.js devuelve por query al texto que se enseña.
 *
 * El callback `signIn` de `src/auth.ts` ya no deniega a nadie, así que
 * `AccessDenied` solo puede venir de fuera: el motivo habitual es que la
 * pantalla de consentimiento de Google siga en modo "Pruebas" y Google rechace
 * a cualquier cuenta que no figure como usuario de prueba. Ese rechazo ocurre
 * antes de que la aplicación vea nada, y de ahí que el texto apunte a esa
 * pantalla y no a una lista de correos interna.
 *
 * Cualquier otro valor se muestra como un fallo genérico, sin texto de
 * Auth.js: sus mensajes internos nombran al proveedor y al callback, que no
 * ayuda a quien solo quiere entrar.
 */
function signInError(error: string | undefined): string | undefined {
  if (!error) return undefined;

  if (error === 'AccessDenied') {
    return (
      'Google no ha dejado entrar con esa cuenta. Si la aplicación sigue en ' +
      'modo pruebas, pide a los novios que la publiquen o que te añadan como ' +
      'usuario de prueba.'
    );
  }

  return 'No se ha podido iniciar sesión con Google. Inténtalo de nuevo.';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Si ya hay sesión no tiene sentido mostrar el formulario. Cada rol aterriza
  // donde le toca: mandar a todos a /admin dejaría a un uploader en un bucle de
  // redirecciones, porque /admin le devuelve a /upload.
  const session = await auth();
  if (session?.user) {
    redirect(isAdmin(session.user.email) ? ROUTES.ADMIN : ROUTES.UPLOAD);
  }

  const { callbackUrl, error } = await searchParams;
  // Solo se admiten rutas internas para evitar redirecciones abiertas.
  // El destino por defecto es /upload, que es donde aterriza cualquier rol:
  // /admin lo verá quien corresponda desde la portada, y mandar a un invitado
  // a /admin solo lo llevaría a /no-autorizado.
  const safeCallback =
    callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : ROUTES.UPLOAD;

  // `auth()` ya usa datos de la petición, así que la página es dinámica y el
  // título se lee ahora, no en el prerender.
  const { title } = getWeddingConfig();

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{title}</p>
        <h1 className={styles.title}>Acceso</h1>
        <p className={styles.subtitle}>
          Esta zona es solo para subir y gestionar las fotos de la boda.
        </p>

        <LoginForm callbackUrl={safeCallback} error={signInError(error)} />
      </div>
    </main>
  );
}
