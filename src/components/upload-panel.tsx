"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type { AppStats, Toast, UploadResponse } from "@/types";
import Uploader from "./uploader";
import styles from "./upload-panel.module.css";
import { signOut } from "next-auth/react";

/**
 * `title` llega como prop desde `UploadPage`, que es un componente de servidor.
 *
 * Antes se leía con `getWeddingConfig()` dentro de este fichero, que estaba
 * marcado como `"use client"`. Como el módulo de entorno usa `node:fs` para
 * localizar los ficheros `.env*`, Turbopack intentaba empaquetarlo para el
 * navegador y el build moría con:
 *
 *   Failed to write app endpoint /upload/page
 *   the chunking context (unknown) does not support external modules (node:fs)
 *
 * Además, aunque hubiera compilado, en el navegador las variables de entorno
 * no existen: el título habría salido vacío. Ese es el motivo de que
 * `src/lib/env.ts` empiece con `import 'server-only'`, y de que este componente
 * no lo importe nunca.
 */
export default function UploadPanel({ title }: { title: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Se incrementa tras cada subida o borrado para forzar la recarga de fotos.
  const [revision, setRevision] = useState(0);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const notify = useCallback(
    (message: string, type: Toast["type"] = "success") => {
      const toast: Toast = { id: generateId(), message, type, duration: 5000 };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration);
    },
    [],
  );

  const handleUploadResult = useCallback(
    (response: UploadResponse) => {
      if (response.uploaded.length > 0) {
        notify(`${response.uploaded.length} foto(s) subidas correctamente.`);
        setRevision((r) => r + 1);
      }
      for (const failure of response.errors) {
        notify(`${failure.fileName}: ${failure.error}`, "error");
      }
    },
    [notify],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(ROUTES.API.STATS, { cache: "no-store" });
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
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  return (
    <main className={styles.box}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de la boda</h1>
          <p className={styles.subtitle}>{title}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className="btn btn-ghost" href={ROUTES.GALLERY}>
            Ver galería
          </Link>
          <Link className="btn btn-ghost" href={ROUTES.HOME}>
            Inicio
          </Link>
          <form
            action={() => signOut({ redirectTo: ROUTES.HOME })}
            className={styles.signOut}
          >
            <button className="btn btn-ghost" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      {statsError ? (
        <p role="alert">No se pudieron cargar los datos: {statsError}</p>
      ) : null}

      {stats && !stats.driveConnected && !statsError ? (
        <p role="status">
          Google Drive no está configurado, así que las subidas van a fallar.
          Copia <code>.env.local.example</code> a <code>.env.local</code>,
          completa las credenciales y ejecuta <code>npm run check:env</code>{" "}
          para ver qué falta.
        </p>
      ) : null}

      <section>
        <Uploader onComplete={handleUploadResult} onNotify={notify} />
      </section>

      <div className={styles.toasts} aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
