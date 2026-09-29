import Link from 'next/link';
import type { Metadata } from 'next';
import { ROUTES, WEDDING_CONFIG } from '@/lib/constants';
import AdminDashboard from '@/components/admin-dashboard';
import styles from './admin.module.css';

export const metadata: Metadata = {
  title: 'Administración',
};

export default function AdminPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de la boda</h1>
          <p className={styles.subtitle}>{WEDDING_CONFIG.title}</p>
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

      <AdminDashboard />
    </main>
  );
}
