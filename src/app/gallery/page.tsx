import type { Metadata } from 'next';
import { ROUTES, WEDDING_CONFIG } from '@/lib/constants';
import GalleryGrid from '@/components/gallery-grid';
import styles from './gallery.module.css';

export const metadata: Metadata = {
  title: 'Galería',
  description: 'Todas las fotos de la boda, aportadas por los invitados.',
};

export default function GalleryPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{WEDDING_CONFIG.title}</h1>
        <p className={styles.subtitle}>Galería de fotos</p>
        <a className="btn btn-ghost" href={ROUTES.HOME}>
          ← Volver al inicio
        </a>
      </header>

      <GalleryGrid />
    </main>
  );
}
