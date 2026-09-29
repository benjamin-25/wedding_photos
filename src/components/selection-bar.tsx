'use client';

import { useState } from 'react';
import styles from './selection-bar.module.css';

type Props = {
  selected: Set<string>;
  total: number;
  busy: boolean;
  onClear: () => void;
  onSelectAll: () => void;
  onDownload: () => void;
};

/**
 * Barra flotante de la galería. Aparece cuando hay al menos una foto
 * seleccionada y permite descargar el subconjunto elegido en un ZIP.
 */
export default function SelectionBar({
  selected,
  total,
  busy,
  onClear,
  onSelectAll,
  onDownload,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const count = selected.size;
  const allSelected = count > 0 && count === total;

  if (count === 0) return null;

  const label = `${count} ${count === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}`;

  return (
    <div className={`glass ${styles.bar}`} role="region" aria-label="Selección de fotos">
      <button
        className={styles.summary}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.count}>{count}</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.chevron} aria-hidden="true">
          {expanded ? '▾' : '▴'}
        </span>
      </button>

      {expanded ? (
        <div className={styles.actions}>
          <button
            className={styles.link}
            onClick={allSelected ? onClear : onSelectAll}
            disabled={busy}
          >
            {allSelected ? 'Deseleccionar todas' : 'Seleccionar todo'}
          </button>

          <button
            className="btn btn-ghost"
            onClick={onClear}
            disabled={busy || count === 0}
          >
            Limpiar
          </button>

          <button
            className="btn btn-primary"
            onClick={onDownload}
            disabled={busy}
          >
            {busy ? 'Preparando ZIP…' : `Descargar ${count === 1 ? 'la foto' : `las ${count} fotos`}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
