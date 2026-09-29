'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG, ROUTES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { DriveFolder, Photo, PhotoListResponse } from '@/types';
import SelectionBar from './selection-bar';
import styles from './gallery-grid.module.css';

type Status = 'idle' | 'loading' | 'loading-more' | 'error' | 'unconfigured';

type AlbumsResponse = { albums: DriveFolder[]; warning?: string };

export default function GalleryGrid() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Filtro por álbum (subcarpeta de Drive).
  const [albums, setAlbums] = useState<DriveFolder[]>([]);
  const [albumId, setAlbumId] = useState<string>('');

  // Selección de fotos para la descarga en ZIP.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  const request = useCallback(
    async (pageToken?: string, folder?: string) => {
      const params = new URLSearchParams({ limit: String(APP_CONFIG.PHOTOS_PER_PAGE) });
      if (pageToken) params.set('pageToken', pageToken);
      if (folder) params.set('folderId', folder);

      const response = await fetch(`${ROUTES.API.PHOTOS}?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      // 503 = faltan credenciales de Drive: no es un fallo transitorio.
      if (response.status === 503) return 'unconfigured' as const;
      if (!response.ok) {
        throw new Error(data?.error || `Error ${response.status}`);
      }
      return data as PhotoListResponse;
    },
    []
  );

  // Los álbumes son un extra: si fallan, la galería sigue mostrando todas las
  // fotos, así que el error se ignora a propósito.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(ROUTES.API.ALBUMS, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as AlbumsResponse;
        if (!cancelled) setAlbums(data.albums ?? []);
      } catch {
        // Sin efecto colateral: el selector de álbumes simplemente no aparece.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Carga inicial y recarga al cambiar de álbum. `status` ya nace en
  // 'loading', así que no hace falta tocar el estado antes de la petición.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await request(undefined, albumId || undefined);
        if (cancelled) return;
        if (result === 'unconfigured') {
          setStatus('unconfigured');
          return;
        }
        setPhotos(result.photos);
        setNextPageToken(result.nextPageToken);
        setStatus('idle');
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la galería');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // `albumId` reinicia la lista: cambia el contenido y el cursor de paginación.
  }, [request, albumId]);

  // Carga de páginas siguientes, disparada por el observer o por un reintento
  // manual (ambos fuera del cuerpo del efecto, así que el estado es válido).
  const loadMore = useCallback(
    async (pageToken?: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setStatus('loading-more');
      setError(null);

      try {
        const result = await request(pageToken, albumId || undefined);
        if (result === 'unconfigured') {
          setStatus('unconfigured');
          return;
        }
        setPhotos((prev) => [...prev, ...result.photos]);
        setNextPageToken(result.nextPageToken);
        setStatus('idle');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la galería');
        setStatus('error');
      } finally {
        busyRef.current = false;
      }
    },
    [request, albumId]
  );

  useEffect(() => {
    if (status !== 'idle' || !nextPageToken) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore(nextPageToken);
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [status, nextPageToken, loadMore]);

  // Navegación con teclado dentro del lightbox.
  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowRight') {
        setActiveIndex((i) => (i === null ? i : Math.min(i + 1, photos.length - 1)));
      }
      if (event.key === 'ArrowLeft') {
        setActiveIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Evita que la página de detrás siga desplazándose con el lightbox abierto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex, photos.length]);

  const togglePhoto = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(photos.map((photo) => photo.id)));
  }, [photos]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /** Cambia de álbum: la selección anterior puede no existir en el nuevo. */
  const changeAlbum = useCallback((nextAlbumId: string) => {
    setSelected(new Set());
    setActiveIndex(null);
    setNotice(null);
    setAlbumId(nextAlbumId);
  }, []);

  /** Dispara la descarga de un blob ya construido por el servidor. */
  const saveBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  const fileNameFrom = useCallback((response: Response, fallback: string) => {
    return response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? fallback;
  }, []);

  /** Descarga las fotos seleccionadas en un único ZIP. */
  const downloadSelected = useCallback(async () => {
    if (selected.size === 0 || downloading) return;
    setDownloading(true);
    setNotice(null);

    try {
      const response = await fetch(ROUTES.API.DOWNLOAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Error ${response.status}`);
      }

      saveBlob(await response.blob(), fileNameFrom(response, 'fotos.zip'));
      setNotice(`${selected.size} foto(s) descargadas.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'No se pudo generar el ZIP');
    } finally {
      setDownloading(false);
    }
  }, [selected, downloading, saveBlob, fileNameFrom]);

  /** Descarga una única foto en su tamaño original. */
  const downloadOne = useCallback(
    async (photo: Photo) => {
      setNotice(null);
      try {
        const response = await fetch(photo.fullUrl);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        saveBlob(await response.blob(), photo.name);
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : 'No se pudo descargar la foto');
      }
    },
    [saveBlob]
  );

  if (status === 'loading') {
    return <p className={styles.feedback}>Cargando fotos…</p>;
  }

  if (status === 'unconfigured') {
    return (
      <div className={`${styles.feedback} ${styles.feedbackCard}`}>
        <h2>La galería todavía no está disponible</h2>
        <p>
          Falta configurar la conexión con Google Drive. El administrador puede completarlo en
          el panel de administración.
        </p>
      </div>
    );
  }

  if (status === 'error' && photos.length === 0) {
    return (
      <div className={`${styles.feedback} ${styles.feedbackCard}`}>
        <h2>No se pudieron cargar las fotos</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => void loadMore()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className={`${styles.feedback} ${styles.feedbackCard}`}>
        <h2>Aún no hay fotos</h2>
        <p>En cuanto subáis las primeras, aparecerán aquí.</p>
      </div>
    );
  }

  const active = activeIndex !== null ? photos[activeIndex] : undefined;

  return (
    <>
      <p className={styles.hint}>
        Pulsa una foto para ampliarla. Usa las casillas para elegir cuáles quieres descargar.
      </p>

      {albums.length > 0 ? (
        <div className={styles.filters}>
          <label className={styles.filter}>
            Álbum
            <select
              value={albumId}
              onChange={(event) => changeAlbum(event.target.value)}
            >
              <option value="">Todas las fotos</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <ul className={styles.grid}>
        {photos.map((photo, index) => {
          const isSelected = selected.has(photo.id);

          return (
            <li key={photo.id} className={styles.item}>
              <button
                className={styles.thumbButton}
                onClick={() => setActiveIndex(index)}
                aria-label={`Ampliar ${photo.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.thumb}
                  src={photo.thumbnailUrl}
                  alt={photo.name}
                  loading={index < 6 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </button>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => togglePhoto(photo.id)}
                  aria-label={`Seleccionar ${photo.name}`}
                />
                <span aria-hidden="true">✓</span>
              </label>

              {isSelected ? <span className={styles.selectedBadge}>Elegida</span> : null}
            </li>
          );
        })}
      </ul>

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {status === 'error' && (
        <p className={styles.errorBanner}>
          {error}{' '}
          <button onClick={() => void loadMore(nextPageToken)}>Reintentar</button>
        </p>
      )}

      <div ref={sentinelRef} className={styles.sentinel}>
        {status === 'loading-more' && <span>Cargando más fotos…</span>}
        {!nextPageToken && photos.length > 0 && <span>Has llegado al final</span>}
      </div>

      <SelectionBar
        selected={selected}
        total={photos.length}
        busy={downloading}
        onClear={clearSelection}
        onSelectAll={selectAll}
        onDownload={() => void downloadSelected()}
      />

      {active && activeIndex !== null && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={active.name}
          onClick={() => setActiveIndex(null)}
        >
          <button
            className={styles.close}
            onClick={() => setActiveIndex(null)}
            aria-label="Cerrar"
          >
            ✕
          </button>

          {activeIndex > 0 && (
            <button
              className={`${styles.nav} ${styles.navPrev}`}
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex(activeIndex - 1);
              }}
              aria-label="Foto anterior"
            >
              ‹
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.full}
            src={active.fullUrl}
            alt={active.name}
            onClick={(event) => event.stopPropagation()}
          />

          {activeIndex < photos.length - 1 && (
            <button
              className={`${styles.nav} ${styles.navNext}`}
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex(activeIndex + 1);
              }}
              aria-label="Foto siguiente"
            >
              ›
            </button>
          )}

          <div className={styles.caption}>
            <p className={styles.captionName}>{active.name}</p>
            {active.createdTime ? (
              <p className={styles.captionDate}>{formatDate(active.createdTime)}</p>
            ) : null}
            <p className={styles.captionCounter}>
              {activeIndex + 1} / {photos.length}
            </p>
            <button
              className={styles.downloadOne}
              onClick={(event) => {
                event.stopPropagation();
                void downloadOne(active);
              }}
            >
              Descargar esta foto
            </button>
          </div>
        </div>
      )}
    </>
  );
}
