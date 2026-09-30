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
 * Aquí solo hay un fallo con nombre propio, `AccessDenied`, que es el que
 * produce el callback `signIn` al devolver `false` para una cuenta que no está
 * en ninguna lista. La lista de correos no se enseña nunca: publicarla sería
 * darle a cualquiera las direcciones de los novios y de sus invitados.
 *
 * Cualquier otro valor se muestra como un fallo genérico, sin texto de
 * Auth.js: sus mensajes internos nombran el proveedor y el callback, que no
 * ayuda a quien solo quiere entrar.
 */
function signInError(error: string | undefined): string | undefined {
  if (!error) return undefined;

  if (error === 'AccessDenied') {
    return 'Esa cuenta de Google no está autorizada. Pídeselo a los novios para que te añadan.';
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
  const safeCallback =
    callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : ROUTES.ADMIN;

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
