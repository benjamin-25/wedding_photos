import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { APP_CONFIG } from '@/lib/constants';
import { isDriveConfigured, uploadPhoto } from '@/lib/google-drive';
import { mapWithConcurrency } from '@/lib/photos';
import type { PhotoMetadata, UploadError, UploadResponse } from '@/types';

export const dynamic = 'force-dynamic';
// Las subidas multipart pueden tardar: se sube el límite por defecto de Vercel.
export const maxDuration = 300;

const MAX_FILES_PER_REQUEST = 50;

/**
 * POST /api/photos/upload
 * Sube una o varias imágenes a Google Drive. Solo administradores.
 *
 * Acepta `multipart/form-data` con uno o varios campos llamados `files`
 * (y opcionalmente `folderId`).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: 'Google Drive no está configurado. Revisa las variables de entorno.' },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'No se pudo leer el cuerpo de la petición. Se esperaba multipart/form-data.' },
      { status: 400 }
    );
  }

  const folderId = formData.get('folderId');
  const targetFolder = typeof folderId === 'string' && folderId ? folderId : undefined;

  const files = formData
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Demasiados archivos (${files.length}). El máximo por petición es ${MAX_FILES_PER_REQUEST}.` },
      { status: 413 }
    );
  }

  // Validación previa: así los archivos inválidos ni siquiera consumen cuota.
  const accepted: File[] = [];
  const errors: UploadError[] = [];

  for (const file of files) {
    if (!APP_CONFIG.ALLOWED_TYPES.includes(file.type as never)) {
      errors.push({
        fileName: file.name,
        error: `Tipo no permitido (${file.type || 'desconocido'})`,
      });
      continue;
    }
    if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
      errors.push({
        fileName: file.name,
        error: `Supera el máximo de ${Math.round(APP_CONFIG.MAX_FILE_SIZE / 1024 / 1024)} MB`,
      });
      continue;
    }
    accepted.push(file);
  }

  const uploaded = await mapWithConcurrency(
    accepted,
    APP_CONFIG.MAX_CONCURRENT_UPLOADS,
    async (file): Promise<PhotoMetadata | null> => {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadPhoto(buffer, file.name, file.type, targetFolder);
        return { id: result.id, name: result.name, mimeType: result.mimeType, size: result.size };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        errors.push({ fileName: file.name, error: message });
        return null;
      }
    }
  );

  const body: UploadResponse = {
    uploaded: uploaded.filter((photo): photo is PhotoMetadata => photo !== null),
    errors,
  };

  return NextResponse.json(body, { status: 201 });
}
