import Link from 'next/link';
import type { Metadata } from 'next';
import { CoupleParallax } from '@/components/couple-parallax';
import { ROUTES, WEDDING_CONFIG } from '@/lib/constants';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Inicio',
};

function formatWeddingDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function Home() {
  const dateLabel = formatWeddingDate(WEDDING_CONFIG.date);

  return (
    <main className={styles.page}>
      <CoupleParallax />
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Nuestra Boda</p>
        <h1 className={styles.title}>{WEDDING_CONFIG.title}</h1>
        {dateLabel ? (
          <p className={styles.date}>{dateLabel}</p>
        ) : (
          <p className={styles.date}>Comparte con nosotros los mejores momentos</p>
        )}

        <div className={styles.actions}>
          <Link className="btn btn-primary" href={ROUTES.GALLERY}>
            Ver la galería
          </Link>
          <Link className="btn btn-ghost" href={ROUTES.ADMIN}>
            Subir fotos
          </Link>
        </div>
      </div>

      <section className={styles.features} aria-label="Cómo funciona">
        <article className="card">
          <span className={styles.step}>1</span>
          <h2>Elige tus fotos</h2>
          <p>
            Desde el móvil. JPEG, PNG, WebP o HEIC de hasta 5&nbsp;MB por
            archivo.
          </p>
        </article>
        <article className="card">
          <span className={styles.step}>2</span>
          <h2>Súbelas aquí mismo</h2>
          <p>
            Se guardan en nuestro Drive privado, así que las fotos no se pierden y estaran completamente seguras.
          </p>
        </article>
        <article className="card">
          <span className={styles.step}>3</span>
          <h2>Compartamos todos juntos</h2>
          <p>
            Comparte el enlace o el código QR de la boda con los invitados para que las vean
            al instante.
          </p>
        </article>
      </section>
    </main>
  );
}
