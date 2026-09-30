'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { COUPLE_CONFIG } from '@/lib/constants';
import styles from './couple-parallax.module.css';

// Cuánto se desplazan los medallones con el ratón, en píxeles, con la
// posición normalizada (entre -1 y 1). Sube estos valores para más recorrido.
const MOUSE_X_SHIFT = 14;
const MOUSE_Y_SHIFT = 8;

/**
 * Fotos de los novios a ambos lados del hero de la portada, con un efecto
 * parallax doble:
 *
 * - **Al hacer scroll**: las dos se mueven más lento que el contenido (factor
 *   `COUPLE_CONFIG.speed`) y en sentidos opuestos, lo que da profundidad.
 * - **Con el ratón**: siguen al cursor con un leve desplazamiento (solo tiene
 *   sentido en escritorio), así el efecto se nota aunque la página no haga
 *   scroll en pantallas grandes.
 *
 * Ambos movimientos se calculan con `requestAnimationFrame` y un solo frame
 * por evento. Si el sistema pide menos movimiento (`prefers-reduced-motion`),
 * las fotos quedan fijas. En pantallas estrechas se ocultan desde el CSS.
 */
export function CoupleParallax() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respeta la preferencia del sistema: nada de parallax si está reducido.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const state = { scrollY: 0, mx: 0, my: 0, raf: 0 };

    const apply = () => {
      state.raf = 0;
      // Scroll: ambas van más lento que el contenido y en sentidos opuestos.
      const offset = state.scrollY * COUPLE_CONFIG.speed;
      // Ratón: desplazamiento horizontal igual para las dos (efecto de capa)
      // y vertical compartido, sobre el recorrido del scroll.
      const x = state.mx * MOUSE_X_SHIFT;
      const y = state.my * MOUSE_Y_SHIFT;
      if (leftRef.current) {
        leftRef.current.style.transform = `translate3d(${x}px, ${offset + y}px, 0)`;
      }
      if (rightRef.current) {
        rightRef.current.style.transform = `translate3d(${x}px, ${-offset + y}px, 0)`;
      }
    };

    const schedule = () => {
      if (state.raf) return; // ya hay un frame pendiente
      state.raf = requestAnimationFrame(apply);
    };

    const onScroll = () => {
      state.scrollY = window.scrollY;
      schedule();
    };

    const onMouseMove = (event: MouseEvent) => {
      // Posición del ratón normalizada respecto al centro de la pantalla:
      // -1 (izquierda/arriba) ... +1 (derecha/abajo).
      state.mx = (event.clientX / window.innerWidth) * 2 - 1;
      state.my = (event.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
      if (state.raf) cancelAnimationFrame(state.raf);
    };
  }, []);

  return (
    <>
      <div ref={leftRef} className={`${styles.slot} ${styles.slotLeft}`}>
        <Image
          className={styles.photo}
          src={COUPLE_CONFIG.left.src}
          alt={COUPLE_CONFIG.left.alt}
          width={400}
          height={400}
          // Las fotos ya van optimizadas como WebP (480 px, <40 KB): se sirven
          // directamente, sin pasar por el optimizador de /_next/image. Así se
          // elimina la caché intermedia y el recorte que causaba el círculo
          // beige cuando el navegador servía una versión vieja de la URL.
          unoptimized
        />
      </div>
      <div ref={rightRef} className={`${styles.slot} ${styles.slotRight}`}>
        <Image
          className={styles.photo}
          src={COUPLE_CONFIG.right.src}
          alt={COUPLE_CONFIG.right.alt}
          width={400}
          height={400}
          unoptimized
        />
      </div>
    </>
  );
}