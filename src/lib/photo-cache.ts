import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { APP_CONFIG } from '@/lib/constants';
import type { PhotoSize } from '@/lib/constants';

/** Únicas variantes que se guardan en disco. `full` va en streaming y no se cachea. */
export type CacheableSize = Exclude<PhotoSize, 'full'>;

/**
 * Caché en disco de las variantes redimensionadas.
 *
 * Sin ella, cada visita a la galería hace dos trabajos caros por foto: una
 * llamada a la API de Drive para bajar el original y un `sharp` para
 * reducirlo. La cabecera `Cache-Control: immutable` solo evita repetir eso en
 * el mismo navegador; cada invitado distinto vuelve a pagarlo entero.
 *
 * Con la caché, la segunda petición de una foto sale del disco: sin red, sin
 * cuota de API de Drive y sin CPU. Eso es lo que además permite que el
 * servidor siga sirviendo la galería con la conexión caída.
 *
 * El ID de Drive es inmutable para un contenido dado, así que basta con él
 * como clave. La revisión de la variante se incluye en la clave para que
 * cambiar `THUMBNAIL_QUALITY` o `MEDIUM_SIZE` no sirva imágenes viejas.
 *
 * El disco es una optimización, nunca un requisito: si el sistema de
 * archivos no permite escribir (Vercel en frío, un volumen de solo lectura),
 * `readVariant` devuelve `null` y `writeVariant` no hace nada, y la ruta sigue
 * funcionando exactamente igual.
 */

/** `PHOTO_CACHE=off` desactiva la caché por completo. */
const CACHE_ENABLED = process.env.PHOTO_CACHE !== 'off';

/**
 * Por defecto en el directorio temporal, que es lo único escribible en
 * Vercel. En un servidor propio conviene apuntar a un disco persistente
 * (`PHOTO_CACHE_DIR=/var/cache/wedding-photos`) para que sobreviva a un
 * reinicio y lo sirva también tras un despliegue.
 */
const CACHE_ROOT =
  process.env.PHOTO_CACHE_DIR || path.join(os.tmpdir(), 'wedding-photo-cache');

/** Firma de cada variante, para invalidar la caché si cambian sus parámetros. */
const VARIANT_REVISION: Record<CacheableSize, string> = {
  thumb: `${APP_CONFIG.THUMBNAIL_SIZE}-${APP_CONFIG.THUMBNAIL_QUALITY}`,
  medium: `${APP_CONFIG.MEDIUM_SIZE}-${APP_CONFIG.MEDIUM_QUALITY}`,
};

/**
 * `null` hasta que se sabe si el sistema de archivos permite escribir. Solo se
 * cachea el **fracaso**: en cuanto se detecta un disco de solo lectura no se
 * vuelve a intentar en cada petición.
 */
let cacheUsable: boolean | null = null;

function keyFor(id: string, size: CacheableSize): { dir: string; hash: string } {
  const hash = createHash('sha256')
    .update(`${id}:${size}:${VARIANT_REVISION[size]}`)
    .digest('hex');
  // Se reparte en subdirectorios de dos caracteres para no acabar con miles
  // de entradas en un mismo directorio.
  return { dir: path.join(CACHE_ROOT, hash.slice(0, 2)), hash };
}

/**
 * Crea el subdirectorio del shard y devuelve si el disco resulta utilizable.
 *
 * El `mkdir` se hace siempre, también cuando ya se sabe que funciona: cada
 * shard tiene su propio directorio y saltarse la creación lo dejaría sin
 * existir. Con `recursive` sobre un directorio ya creado es casi gratis.
 */
async function ensureUsable(dir: string): Promise<boolean> {
  if (cacheUsable === false) return false;

  try {
    await mkdir(dir, { recursive: true });
    cacheUsable = true;
  } catch (error) {
    console.warn(
      `[photo-cache] Caché en disco desactivada (${dir}):`,
      error instanceof Error ? error.message : String(error)
    );
    cacheUsable = false;
  }
  return cacheUsable;
}

export interface CachedVariant {
  data: Buffer;
  mimeType: string;
}

/**
 * Lee una variante de la caché. Devuelve `null` si no está, si la caché está
 * desactivada o si el disco no sirve: nunca lanza.
 */
export async function readVariant(
  id: string,
  size: CacheableSize
): Promise<CachedVariant | null> {
  if (!CACHE_ENABLED) return null;

  const { dir, hash } = keyFor(id, size);
  if (!(await ensureUsable(dir))) return null;

  try {
    const [data, meta] = await Promise.all([
      readFile(path.join(dir, `${hash}.bin`)),
      readFile(path.join(dir, `${hash}.meta`), 'utf8'),
    ]);
    return { data, mimeType: meta };
  } catch {
    // No está en caché: es el caso normal, no un error.
    return null;
  }
}

/**
 * Guarda una variante. La escritura es atómica (fichero temporal + `rename`)
 * para que dos peticiones simultáneas de la misma foto no se pisen y dejen
 * un `.bin` a medias. Nunca lanza.
 */
export async function writeVariant(
  id: string,
  size: CacheableSize,
  data: Buffer,
  mimeType: string
): Promise<void> {
  if (!CACHE_ENABLED) return;

  const { dir, hash } = keyFor(id, size);
  if (!(await ensureUsable(dir))) return;

  const suffix = randomBytes(6).toString('hex');
  const binTmp = path.join(dir, `${hash}.${suffix}.tmp`);
  const metaTmp = path.join(dir, `${hash}.${suffix}.meta.tmp`);

  try {
    await Promise.all([
      writeFile(binTmp, data),
      writeFile(metaTmp, mimeType),
    ]);
    await rename(binTmp, path.join(dir, `${hash}.bin`));
    await rename(metaTmp, path.join(dir, `${hash}.meta`));
  } catch (error) {
    console.warn(
      `[photo-cache] No se pudo guardar ${size} de ${id}:`,
      error instanceof Error ? error.message : String(error)
    );
    await Promise.all([rm(binTmp, { force: true }), rm(metaTmp, { force: true })]).catch(
      () => {}
    );
  }
}
