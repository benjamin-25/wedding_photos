import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { canUpload } from '@/lib/access';
import { ROUTES } from '@/lib/constants';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Sin acceso',
};

/**
 * Aterrizaje de quien tiene sesión pero no puede estar donde ha pedido estar.
 *
 * Con el login abierto hay dos casos, y el texto depende de cuál sea:
 *
 * 1. **Un invitado que ha pedido `/admin`.** Puede subir fotos, solo que la
 *    gestión de la galería es de los novios: se le dice eso y se le manda a
 *    /upload, que es donde sí tiene sitio.
 * 2. **Una sesión sin email**, a la que ni /upload deja pasar (sin email no
 *    hay rol posible). Es casi teórico, pero existe y hay que poder
 *    explicárselo.
 *
 * Lo que no puede ser que esta página mande a /login, porque ahí `auth()`
 * encuentra la sesión todavía viva, la manda a /upload, y /upload le devuelve
 * aquí: un bucle de redirecciones. Por eso esta página es la salida y el cierre
 * de sesión va en un formulario aparte.
 */
export default async function UnauthorizedPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const isGuest = email !== null && canUpload(email);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {isGuest ? 'Zona de administración' : 'Tu cuenta ya no tiene acceso'}
        </h1>

        {isGuest ? (
          <>
            <p className={styles.text}>
              {`Has entrado como ${email}, pero la administración de la galería ` +
                '(borrar fotos, cambiar la carpeta y descargarlo todo) está ' +
                'reservada a los novios.'}
            </p>

            <p className={styles.text}>
              Tú puedes subir tus fotos cuando quieras.
            </p>
          </>
        ) : (
          <>
            <p className={styles.text}>
              {email
                ? `Has entrado como ${email}, pero esta cuenta no puede subir fotos.`
                : 'Esta cuenta no puede subir fotos.'}
            </p>

            <p className={styles.text}>
              Revisa que la dirección con la que entras sea la misma que usan
              los demás invitados. Si crees que es un error, pídeselo a los
              novios.
            </p>
          </>
        )}

        <div className={styles.actions}>
          {isGuest && (
            <Link className="btn btn-primary" href={ROUTES.UPLOAD}>
              Subir mis fotos
            </Link>
          )}

          {session?.user && (
            <form action={async () => {
              'use server';
              await signOut({ redirectTo: ROUTES.LOGIN });
            }}>
              <button className="btn btn-ghost" type="submit">
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
