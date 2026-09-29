'use client';

import { useRef, useState } from 'react';
import { APP_CONFIG, ROUTES } from '@/lib/constants';
import { formatFileSize, generateId } from '@/lib/utils';
import type { Toast, UploadFile, UploadResponse } from '@/types';
import styles from './uploader.module.css';

type Props = {
  onComplete: (response: UploadResponse) => void;
  onNotify: (message: string, type?: Toast['type']) => void;
};

const ACCEPT = APP_CONFIG.ALLOWED_EXTENSIONS.join(',');

export default function Uploader({ onComplete, onNotify }: Props) {
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const incoming: UploadFile[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(fileList)) {
      if (!APP_CONFIG.ALLOWED_TYPES.includes(file.type as never)) {
        rejected.push(`${file.name}: tipo no permitido`);
        continue;
      }
      if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        rejected.push(
          `${file.name}: supera ${formatFileSize(APP_CONFIG.MAX_FILE_SIZE)}`
        );
        continue;
      }
      incoming.push({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        preview: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      });
    }

    if (rejected.length > 0) {
      onNotify(rejected.join(' · '), 'error');
    }
    if (incoming.length > 0) {
      setQueue((prev) => [...prev, ...incoming]);
    }
  }

  function removeFile(id: string) {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
  }

  function patchFile(id: string, patch: Partial<UploadFile>) {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function upload() {
    const pending = queue.filter((item) => item.status === 'pending');
    if (pending.length === 0 || uploading) return;

    setUploading(true);

    for (const item of pending) {
      patchFile(item.id, { status: 'uploading', progress: 40 });

      const body = new FormData();
      body.append('files', item.file);

      try {
        const response = await fetch(ROUTES.API.UPLOAD, { method: 'POST', body });

        if (response.status === 401) {
          onNotify('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'error');
          patchFile(item.id, { status: 'error', error: 'Sesión caducada' });
          continue;
        }

        const data = (await response.json()) as UploadResponse & { error?: string };

        if (!response.ok) {
          patchFile(item.id, {
            status: 'error',
            error: data.error || `Error ${response.status}`,
          });
          continue;
        }

        patchFile(item.id, { status: 'completed', progress: 100 });
        onComplete(data);
      } catch (error) {
        patchFile(item.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Error de red',
        });
      }
    }

    setUploading(false);
    // Se retiran los archivos ya subidos, se conservan los fallidos.
    setQueue((prev) => {
      const done = prev.filter((item) => item.status === 'completed');
      for (const item of done) URL.revokeObjectURL(item.preview);
      return prev.filter((item) => item.status !== 'completed');
    });
  }

  const pendingCount = queue.filter((item) => item.status === 'pending').length;

  return (
    <section className={`card ${styles.panel}`} aria-label="Subir fotos">
      <h2 className={styles.heading}>Subir fotos</h2>
      <p className={styles.hint}>
        {APP_CONFIG.ALLOWED_EXTENSIONS.join(' · ')} — máx.{' '}
        {formatFileSize(APP_CONFIG.MAX_FILE_SIZE)} por archivo
      </p>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
      >
        <span className={styles.dropzoneIcon}>＋</span>
        <p className={styles.dropzoneTitle}>Arrastra las fotos aquí</p>
        <p className={styles.dropzoneSub}>o haz clic para elegir archivos</p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className={styles.queue}>
          {queue.map((item) => (
            <li key={item.id} className={styles.item}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.preview} src={item.preview} alt="" />
              <div className={styles.itemBody}>
                <p className={styles.itemName} title={item.name}>
                  {item.name}
                </p>
                <p className={styles.itemMeta}>
                  {formatFileSize(item.size)}
                  {item.error ? <span className={styles.itemError}> · {item.error}</span> : null}
                </p>
                {item.status === 'uploading' && (
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${item.progress}%` }} />
                  </div>
                )}
              </div>
              <span className={styles.badge} data-status={item.status}>
                {item.status === 'pending'
                  ? 'En espera'
                  : item.status === 'uploading'
                    ? 'Subiendo…'
                    : item.status === 'completed'
                      ? '✓'
                      : 'Error'}
              </span>
              {item.status !== 'uploading' && (
                <button
                  className={styles.remove}
                  onClick={() => removeFile(item.id)}
                  aria-label={`Quitar ${item.name}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        className="btn btn-primary"
        onClick={() => void upload()}
        disabled={uploading || pendingCount === 0}
      >
        {uploading
          ? 'Subiendo…'
          : pendingCount > 0
            ? `Subir ${pendingCount} foto${pendingCount > 1 ? 's' : ''}`
            : 'Nada que subir'}
      </button>
    </section>
  );
}
