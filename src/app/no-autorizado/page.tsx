import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { ROUTES } from '@/lib/constants';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Sin acceso',
};

/**
 * Aterrizaje de quien tiene sesión pero ningún rol.
 *
 * Es un caso real, no decorativo: si a alguien se le quita de `UPLOAD_EMAILS`
 * sin que su sesión haya caducado, cada visita a `/upload` le devuelve aquí. Lo
 * que no puede ser es que le devuelva al login, porque ahí `auth()` encuentra la
 * sesión todavía viva, lo manda a /upload, y /upload le devuelve aquí: un bucle
 * de redirecciones. Por eso esta página es la salida y el cierre de sesión va en
 * un formulario aparte.
 */
export default async function UnauthorizedPage() {
  const session = await auth();

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Tu cuenta ya no tiene acceso</h1>

        <p className={styles.text}>
          {session?.user?.email
            ? `Has entrado como ${session.user.email}, pero esa cuenta ya no figura entre las autorizadas para subir fotos.`
            : 'Esta cuenta no figura entre las autorizadas para subir fotos.'}
        </p>

        <p className={styles.text}>
          Pídeselo a los novios para que te añadan. Si crees que es un error,
          revisa que la dirección con la que entras sea la misma que ellos
          configuraron.
        </p>

        <div className={styles.actions}>
          {session?.user && (
            <form action={async () => {
              'use server';
              await signOut({ redirectTo: ROUTES.LOGIN });
            }}>
              <button className="btn btn-primary" type="submit">
                Entrar con otra cuenta
              </button>
            </form>
          )}

          <Link className="btn btn-ghost" href={ROUTES.GALLERY}>
            Ver la galería
          </Link>
        </div>
      </div>
    </main>
  );
}