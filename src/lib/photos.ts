import { ROUTES } from '@/lib/constants';
import type { Photo } from '@/types';

type DriveFile = {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
};

/**
 * Convierte un archivo de la API de Google Drive al modelo `Photo` de la app.
 *
 * `thumbnailUrl` y `fullUrl` apuntan a la ruta de proxy propia
 * (`/api/photos/:id/raw`) en lugar de a Google, de modo que las credenciales
 * de la cuenta de servicio nunca salen del servidor y la galería funciona
 * aunque la carpeta de Drive sea privada. La miniatura pide la variante
 * `thumb`, que el servidor redimensiona con sharp.
 */
export function toPhoto(file: DriveFile): Photo {
  const id = file.id || '';

  return {
    id,
    name: file.name || 'foto',
    mimeType: file.mimeType || 'image/jpeg',
    size: file.size || '0',
    createdTime: file.createdTime || '',
    modifiedTime: file.modifiedTime || '',
    thumbnailUrl: ROUTES.API.PHOTO_RAW(id, 'thumb'),
    fullUrl: ROUTES.API.PHOTO_RAW(id, 'full'),
  };
}

/**
 * Ejecuta `worker` sobre `items` respetando un máximo de tareas en paralelo.
 * Se usa para no saturar la cuota de la API de Google Drive al subir fotos.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: size }, run));
  return results;
}
