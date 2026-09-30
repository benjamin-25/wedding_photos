import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ROUTES } from '@/lib/constants';
import { getWeddingConfig } from '@/lib/env';
import GalleryGrid from '@/components/gallery-grid';
import styles from './gallery.module.css';

export const metadata: Metadata = {
  title: 'Galería',
  description: 'Todas las fotos de la boda, aportadas por los invitados.',
};

export default async function GalleryPage() {
  // Para que el título se lea en cada petición y no quede congelado en el
  // prerender de `next build`.
  await connection();

  const { title } = getWeddingConfig();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>Galería de fotos</p>
        <a className="btn btn-ghost" href={ROUTES.HOME}>
          ← Volver al inicio
        </a>
      </header>

      <GalleryGrid />
    </main>
  );
}
