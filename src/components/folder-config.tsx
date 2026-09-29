'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROUTES } from '@/lib/constants';
import type { DriveFolder, Toast } from '@/types';
import styles from './folder-config.module.css';

type Props = {
  folderId: string | null;
  folderName: string | null;
  onNotify: (message: string, type?: Toast['type']) => void;
};

/**
 * Muestra la carpeta de Drive configurada y sus subcarpetas.
 *
 * El identificador de la carpeta principal vive en `GOOGLE_DRIVE_FOLDER_ID`
 * (archivo `.env.local`) porque lo usa la cuenta de servicio en el servidor; por
 * eso este panel no la cambia, solo la consulta y explica cómo hacerlo.
 */
export default function FolderConfig({ folderId, folderName, onNotify }: Props) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(ROUTES.API.FOLDERS, { cache: 'no-store' });

      if (response.status === 503) {
        setFolders([]);
        setError(null);
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Error ${response.status}`);
      }

      const data = (await response.json()) as { folders: DriveFolder[] };
      setFolders(data.folders);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron leer las carpetas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await load();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const copyId = useCallback(async () => {
    if (!folderId) return;
    try {
      await navigator.clipboard.writeText(folderId);
      onNotify('Identificador de la carpeta copiado.');
    } catch {
      onNotify('No se pudo copiar. Cópialo manualmente.', 'error');
    }
  }, [folderId, onNotify]);

  return (
    <section className={`card ${styles.panel}`} aria-label="Configuración de la carpeta">
      <div className={styles.header}>
        <h2 className={styles.heading}>Carpeta de Google Drive</h2>
        {folderId ? (
          <button className="btn btn-ghost" onClick={() => void copyId()}>
            Copiar ID
          </button>
        ) : null}
      </div>

      <dl className={styles.fields}>
        <div>
          <dt>Nombre</dt>
          <dd>{folderName ?? 'Sin configurar'}</dd>
        </div>
        <div>
          <dt>Identificador</dt>
          <dd className={styles.mono} title={folderId ?? ''}>
            {folderId ?? '—'}
          </dd>
        </div>
      </dl>

      <p className={styles.note}>
        Para cambiar la carpeta principal edita <code>GOOGLE_DRIVE_FOLDER_ID</code> en{' '}
        <code>.env.local</code> y reinicia el servidor. Comparte la carpeta con la cuenta de
        servicio como <strong>Editor</strong>.
      </p>

      <div className={styles.subfolders}>
        <button
          className={styles.disclosure}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '▾' : '▸'} Subcarpetas ({folders.length})
        </button>

        {open ? (
          loading ? (
            <p className={styles.feedback}>Cargando…</p>
          ) : error ? (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          ) : folders.length === 0 ? (
            <p className={styles.feedback}>Esta carpeta no tiene subcarpetas.</p>
          ) : (
            <ul className={styles.list}>
              {folders.map((folder) => (
                <li key={folder.id}>
                  <span title={folder.name}>{folder.name}</span>
                  <code className={styles.mono}>{folder.id}</code>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  );
}
