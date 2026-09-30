import 'server-only';

/**
 * Punto de entrada único a la configuración del servidor. Todo el código de la
 * aplicación importa las variables desde aquí, nunca desde `process.env`.
 *
 * `import 'server-only'` es la pieza que evita el fallo más difícil de detectar
 * de este proyecto. Next.js solo expone al navegador las variables con prefijo
 * `NEXT_PUBLIC_`; el resto se sustituye por `undefined` al compilar el bundle
 * del cliente. Con la configuración repartida en varios módulos, un componente
 * de cliente que importara uno de ellos leía `undefined` sin ningún error: el
 * título de la boda y la URL del código QR salían vacíos **en el navegador**
 * mientras las páginas del servidor los mostraban bien. Por eso el mismo valor
 * "a veces" se aplicaba y a veces no, según desde dónde se leyera.
 *
 * Con este import, meter configuración del servidor en un componente de cliente
 * es un fallo de compilación con un mensaje claro, no un `undefined` silencioso.
 * Cuando haga falta un valor en el navegador hay que pasarlo como prop desde un
 * componente de servidor, que es lo que hacen `AdminPage` y `Footer`.
 *
 * Los valores se leen por llamada, no al importar el módulo, de modo que una
 * página renderizada en cada petición ve la configuración de ese momento. Para
 * ver qué ha leído la app de verdad: `npm run check:env` o `GET /api/drive/env`.
 *
 * La lógica está en `env-core.ts` porque el script de diagnóstico la necesita
 * desde Node pelado, donde el marcador `server-only` lanzaría una excepción.
 */

export * from '@/lib/env-core';
