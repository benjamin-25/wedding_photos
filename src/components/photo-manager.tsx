'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROUTES } from '@/lib/constants';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { Photo, PhotoListResponse, Toast } from '@/types';
import styles from './photo-manager.module.css';

type Props = {
  revision: number;
  onDeleted: () => void;
  onNotify: (message: string, type?: Toast['type']) => void;
};

export default function PhotoManager({ revision, onDeleted, onNotify }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Selección para borrado en lote.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);

  const allSelected = photos.length > 0 && selected.size === photos.length;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${ROUTES.API.PHOTOS}?limit=100`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (cancelled) return;

        if (response.status === 503) {
          setError('Google Drive no está configurado.');
          setPhotos([]);
          return;
        }
        if (!response.ok) {
          throw new Error(data?.error || `Error ${response.status}`);
        }

        setPhotos((data as PhotoListResponse).photos);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === photos.length ? new Set() : new Set(photos.map((p) => p.id))
    );
  }, [photos]);

  /** Comparte la lógica de borrado entre la vista individual y la por lotes. */
  const removePhotos = useCallback(
    async (targets: Photo[], askForConfirmation: boolean) => {
      if (askForConfirmation) {
        const label =
          targets.length === 1
            ? `"${targets[0]?.name}"`
            : `${targets.length} fotos seleccionadas`;
        if (!window.confirm(`¿Eliminar ${label}? Se borrarán de Google Drive de forma permanente.`)) {
          return;
        }
      }

      const deleted: string[] = [];

      for (const photo of targets) {
        setBusyId(photo.id);
        try {
          const response = await fetch(ROUTES.API.PHOTO(photo.id), { method: 'DELETE' });

          if (response.status === 401) {
            onNotify('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'error');
            return;
          }
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || `Error ${response.status}`);
          }

          deleted.push(photo.id);
        } catch (cause) {
          onNotify(
            cause instanceof Error ? cause.message : 'No se pudo eliminar la foto',
            'error'
          );
        }
      }

      setBusyId(null);

      if (deleted.length > 0) {
        const removed = new Set(deleted);
        setPhotos((prev) => prev.filter((item) => !removed.has(item.id)));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of deleted) next.delete(id);
          return next;
        });
        onDeleted();
        onNotify(
          deleted.length === 1
            ? 'Foto eliminada.'
            : `${deleted.length} fotos eliminadas.`
        );
      }
    },
    [onDeleted, onNotify]
  );

  const deleteSelected = useCallback(async () => {
    if (selected.size === 0 || deletingBatch) return;
    setDeletingBatch(true);
    try {
      await removePhotos(photos.filter((p) => selected.has(p.id)), true);
    } finally {
      setDeletingBatch(false);
    }
  }, [selected, deletingBatch, photos, removePhotos]);

  async function downloadZip() {
    setDownloading(true);
    try {
      const response = await fetch(ROUTES.API.DOWNLOAD, { cache: 'no-store' });

      if (response.status === 401) {
        onNotify('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'error');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Error ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ??
        'fotos.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      onNotify('Descarga iniciada.');
    } catch (error) {
      onNotify(
        error instanceof Error ? error.message : 'No se pudo generar el ZIP',
        'error'
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className={`card ${styles.panel}`} aria-label="Gestionar fotos">
      <div className={styles.header}>
        <h2 className={styles.heading}>Fotos ({photos.length})</h2>
        <div className={styles.headerTools}>
          {photos.length > 0 ? (
            <label className={styles.selectAll}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Seleccionar todas las fotos"
              />
              <span>{allSelected ? 'Quitar todas' : 'Seleccionar todas'}</span>
            </label>
          ) : null}
          <button
            className="btn btn-ghost"
            onClick={() => void downloadZip()}
            disabled={downloading || photos.length === 0}
          >
            {downloading ? 'Generando ZIP…' : 'Descargar ZIP'}
          </button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className={styles.batchBar}>
          <span>
            {selected.size} {selected.size === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
          </span>
          <div className={styles.batchActions}>
            <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
              Limpiar
            </button>
            <button
              className="btn btn-danger"
              onClick={() => void deleteSelected()}
              disabled={deletingBatch}
            >
              {deletingBatch ? 'Eliminando…' : `Eliminar ${selected.size}`}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className={styles.feedback}>Cargando…</p>
      ) : error ? (
        <p className={styles.feedback} role="alert">
          {error}
        </p>
      ) : photos.length === 0 ? (
        <p className={styles.feedback}>Todavía no hay fotos.</p>
      ) : (
        <ul className={styles.list}>
          {photos.map((photo) => (
            <li key={photo.id} className={styles.item}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={selected.has(photo.id)}
                  onChange={() => toggle(photo.id)}
                  aria-label={`Seleccionar ${photo.name}`}
                />
                <span aria-hidden="true">✓</span>
              </label>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.thumb}
                src={photo.thumbnailUrl}
                alt=""
                loading="lazy"
                decoding="async"
              />

              <div className={styles.body}>
                <p className={styles.name} title={photo.name}>
                  {photo.name}
                </p>
                <p className={styles.meta}>
                  {formatFileSize(Number(photo.size))}
                  {photo.createdTime ? ` · ${formatDate(photo.createdTime)}` : ''}
                </p>
              </div>

              <a
                className={styles.action}
                href={photo.fullUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${photo.name}`}
              >
                ↗
              </a>
              <button
                className={styles.action}
                onClick={() => void removePhotos([photo], true)}
                disabled={busyId === photo.id}
                aria-label={`Eliminar ${photo.name}`}
              >
                {busyId === photo.id ? '…' : '🗑'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
