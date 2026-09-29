'use client';

import { useCallback, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import styles from './share-card.module.css';

const SIZES = [128, 168, 256, 512] as const;
const COLORS = {
  negro: '#1a1a2e',
  dorado: '#b8843f',
} as const;

type QrSize = (typeof SIZES)[number];
type QrColor = keyof typeof COLORS;

export default function ShareCard({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<QrSize>(256);
  const [color, setColor] = useState<QrColor>('negro');
  const [exportError, setExportError] = useState<string | null>(null);

  const qrRef = useRef<HTMLDivElement>(null);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [url]);

  const fileBase = useCallback(() => `qr-${title.toLowerCase().replace(/\s+/g, '-')}`, [title]);

  /** Serializa el `<svg>` que ha renderizado `QRCodeSVG`. */
  const serialize = useCallback((): { markup: string; svg: SVGSVGElement } | null => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return null;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Fondo blanco: al compartirlo fuera, un PNG transparente se ve mal en
    // impresoras y en fonds oscuros.
    clone.setAttribute('style', 'background:#ffffff');

    return {
      markup: new XMLSerializer().serializeToString(clone),
      svg,
    };
  }, []);

  const saveBlob = useCallback((blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }, []);

  const downloadSvg = useCallback(() => {
    setExportError(null);
    const result = serialize();
    if (!result) {
      setExportError('El código QR no está listo.');
      return;
    }
    saveBlob(
      new Blob([result.markup], { type: 'image/svg+xml;charset=utf-8' }),
      `${fileBase()}.svg`
    );
  }, [serialize, saveBlob, fileBase]);

  /**
   * Exporta a PNG dibujando el SVG sobre un canvas al doble de resolución.
   * El canvas queda más nítido al imprimir o compartir.
   */
  const downloadPng = useCallback(() => {
    setExportError(null);
    const result = serialize();
    if (!result) {
      setExportError('El código QR no está listo.');
      return;
    }

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = size * scale;
    canvas.height = size * scale;

    const context = canvas.getContext('2d');
    if (!context) {
      setExportError('Este navegador no permite generar la imagen.');
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          setExportError('No se pudo generar el PNG.');
          return;
        }
        saveBlob(blob, `${fileBase()}.png`);
      }, 'image/png');
    };
    image.onerror = () => setExportError('No se pudo generar el PNG.');
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(result.markup)))}`;
  }, [serialize, saveBlob, fileBase, size]);

  return (
    <section className={`card ${styles.panel}`} aria-label="Compartir la galería">
      <h2 className={styles.heading}>Comparte la galería</h2>
      <p className={styles.hint}>
        Escanead el código o copiad el enlace para que los invitados consulten las fotos.
      </p>

      <div className={styles.qr} ref={qrRef}>
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor={COLORS[color]}
          marginSize={1}
        />
      </div>

      <div className={styles.options}>
        <label className={styles.option}>
          Tamaño
          <select
            value={size}
            onChange={(event) => setSize(Number(event.target.value) as QrSize)}
          >
            {SIZES.map((value) => (
              <option key={value} value={value}>
                {value} px
              </option>
            ))}
          </select>
        </label>

        <label className={styles.option}>
          Color
          <select
            value={color}
            onChange={(event) => setColor(event.target.value as QrColor)}
          >
            {Object.keys(COLORS).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.exports}>
        <button className="btn btn-ghost" onClick={downloadPng}>
          Descargar PNG
        </button>
        <button className="btn btn-ghost" onClick={downloadSvg}>
          Descargar SVG
        </button>
      </div>

      {exportError ? (
        <p className={styles.error} role="alert">
          {exportError}
        </p>
      ) : null}

      <div className={styles.linkRow}>
        <span className={styles.link} title={url}>
          {url}
        </span>
        <button className="btn btn-ghost" onClick={() => void copy()}>
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>

      <a className={`btn btn-primary ${styles.openLink}`} href={url} target="_blank">
        Abrir la galería de {title}
      </a>
    </section>
  );
}
