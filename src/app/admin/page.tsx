import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { ROUTES } from '@/lib/constants';
import { getWeddingConfig } from '@/lib/env';
import AdminDashboard from '@/components/admin-dashboard';
import styles from './admin.module.css';

export const metadata: Metadata = {
  title: 'Administración',
};

export default async function AdminPage() {
  const { title, appUrl, galleryPath } = getWeddingConfig();

  // El QR necesita una URL absoluta. Con `APP_URL` sin definir o inválida se cae
  // al dominio de la petición, que en local es la IP de la máquina y por eso los
  // invitados tienen que usar esa misma red. Se leen las cabeceras siempre, y no
  // solo en el `else`: si el origen se consultedara únicamente cuando falta
  // `APP_URL`, la página se prerenderizaría en `next build` con la configuración
  // de ese momento, que es justo lo que hace que `APP_URL` "no se aplique".
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const origin = appUrl || `${proto}://${host}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de la boda</h1>
          <p className={styles.subtitle}>{title}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className="btn btn-ghost" href={ROUTES.GALLERY}>
            Ver galería
          </Link>
          <Link className="btn btn-ghost" href={ROUTES.HOME}>
            Inicio
          </Link>
        </div>
      </header>

      <AdminDashboard title={title} galleryUrl={`${origin}${galleryPath}`} />
    </main>
  );
}
