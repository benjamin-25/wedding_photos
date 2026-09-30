'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROUTES } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import type { AppStats, Toast } from '@/types';
import PhotoManager from './photo-manager';
import FolderConfig from './folder-config';
import ShareCard from './share-card';
import styles from './admin-dashboard.module.css';

/**
 * `title` y `galleryUrl` llegan como props desde `AdminPage`, que es un
 * componente de servidor. Antes este componente leía `WEDDING_TITLE` y
 * `APP_URL` directamente: al ser un componente de cliente, Next.js las
 * sustituía por `undefined` al compilar el bundle y el código QR salía con una
 * ruta relativa, mientras las páginas del servidor mostraban el título sin
 * problema. Que las variables se leyeran "a veces" dependía de quién preguntara.
 */
export default function AdminDashboard({
  title,
  galleryUrl,
}: {
  title: string;
  galleryUrl: string;
}) {
  const [stats, setStats] = useState<AppStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Se incrementa tras cada subida o borrado para forzar la recarga de fotos.
  const [revision, setRevision] = useState(0);

  const notify = useCallback((message: string, type: Toast['type'] = 'success') => {
    const toast: Toast = { id: generateId(), message, type, duration: 5000 };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, toast.duration);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(ROUTES.API.STATS, { cache: 'no-store' });
        if (cancelled) return;

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || `Error ${response.status}`);
        }

        setStats((await response.json()) as AppStats);
        setStatsError(null);
      } catch (error) {
        if (cancelled) return;
        setStatsError(
          error instanceof Error ? error.message : 'No se pudieron cargar los datos'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const handleDeleted = useCallback(() => {
    setRevision((r) => r + 1);
  }, []);

  return (
    <div className={styles.box}>
      <section className={styles.stats} aria-label="Resumen">
        <div className="card">
          <p className={styles.statLabel}>Fotos</p>
          <p className={styles.statValue}>{stats?.totalPhotos ?? '—'}</p>
        </div>
        <div className="card">
          <p className={styles.statLabel}>Espacio</p>
          <p className={styles.statValue}>{stats?.totalSize ?? '—'}</p>
        </div>
        <div className="card">
          <p className={styles.statLabel}>Carpeta</p>
          <p className={`${styles.statValue} ${styles.statSmall}`}>
            {stats?.folderName ?? '—'}
          </p>
        </div>
        <div className="card">
          <p className={styles.statLabel}>Drive</p>
          <p
            className={`${styles.statValue} ${styles.statSmall} ${
              stats?.driveConnected ? styles.ok : styles.bad
            }`}
          >
            {stats?.driveConnected ? 'Conectado' : 'Sin configurar'}
          </p>
        </div>
      </section>

      {statsError ? (
        <p className={styles.banner} role="alert">
          {statsError}
        </p>
      ) : null}

      {!stats?.driveConnected && !statsError ? (
        <p className={styles.banner} role="status">
          Google Drive no está configurado. Copia <code>.env.local.example</code> a{' '}
          <code>.env.local</code> y completa las credenciales.
        </p>
      ) : null}

      <section className={styles.columns}>
        <ShareCard title={title} url={galleryUrl} />
      </section>

      <FolderConfig
        folderId={stats?.folderId ?? null}
        folderName={stats?.folderName ?? null}
        onNotify={notify}
      />

      <PhotoManager
        revision={revision}
        onDeleted={handleDeleted}
        onNotify={notify}
      />

      <div className={styles.toasts} aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
