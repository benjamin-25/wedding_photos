'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import styles from './theme-toggle.module.css';

/**
 * Clave de `localStorage`. Debe coincidir con la que usa el script en línea de
 * `app/layout.tsx`.
 */
const STORAGE_KEY = 'theme';

/** Evento interno para avisar de que el atributo cambió. */
const CHANGE_EVENT = 'wedding:theme-change';

type Theme = 'light' | 'dark';

/** Lee la preferencia guardada, o `null` si no hay ninguna válida. */
function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Modo privado o `localStorage` bloqueado: se sigue la preferencia del SO.
    return null;
  }
}

/** Escribe el tema en `<html>` y avisa a los suscriptores. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * El tema vive en el DOM, no en estado de React: lo pone el script en línea
 * antes del primer pintado. `useSyncExternalStore` lo lee y se queda
 * suscrito, con lo que el botón refleja siempre el valor real.
 *
 * El icono NO depende de este valor: se elige por CSS con `data-theme`, de modo
 * que servidor y cliente pintan lo mismo y no hay desajuste de hidratación
 * aunque el visitante esté en tema oscuro.
 */
function subscribe(onStoreChange: () => void) {
  // Cambia el tema del sistema: relevante solo si el visitante no ha elegido.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onMediaChange = () => {
    if (readStoredTheme() === null) {
      applyTheme(media.matches ? 'dark' : 'light');
    }
    onStoreChange();
  };

  // Otro pestaña cambió el tema.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const next = readStoredTheme();
    if (next) applyTheme(next);
    onStoreChange();
  };

  media.addEventListener('change', onMediaChange);
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    media.removeEventListener('change', onMediaChange);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Lo que el servidor da por hecho hasta que el script en línea corrije. */
function getServerSnapshot(): Theme {
  return 'light';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // En desarrollo, el doble montaje de Strict Mode limpia los atributos que
  // React gestiona en `<html>`, incluido `data-theme`, y el script en línea no
  // vuelve a correr. Esto lo repone. En producción no hace nada.
  useEffect(() => {
    if (document.documentElement.dataset.theme) return;

    const stored = readStoredTheme();
    if (stored) applyTheme(stored);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme =
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';

    applyTheme(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento el tema funciona igual, solo que no se recuerda.
    }
  }, []);

  const label =
    theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      suppressHydrationWarning
      aria-label={label}
      title={label}
    >
      {/* Sol: visible en tema oscuro, es la acción que queda disponible. */}
      <svg
        className={`${styles.icon} ${styles.sun}`}
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      {/* Luna: visible en tema claro. */}
      <svg
        className={`${styles.icon} ${styles.moon}`}
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 3a6.36 6.36 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}