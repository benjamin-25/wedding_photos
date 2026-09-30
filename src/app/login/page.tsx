import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { ROUTES } from '@/lib/constants';
import { getWeddingConfig } from '@/lib/env';
import LoginForm from './login-form';
import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Acceso',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Si ya hay sesión no tiene sentido mostrar el formulario.
  const session = await auth();
  if (session?.user) {
    redirect(ROUTES.ADMIN);
  }

  const { callbackUrl } = await searchParams;
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
        <h1 className={styles.title}>Acceso de administración</h1>
        <p className={styles.subtitle}>
          Esta zona es solo para subir y gestionar las fotos de la boda.
        </p>

        <LoginForm callbackUrl={safeCallback} />
      </div>
    </main>
  );
}
