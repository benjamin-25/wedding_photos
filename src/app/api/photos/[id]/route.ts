import { NextResponse } from 'next/server';
import { deletePhoto, getPhotoMetadata, isDriveConfigured } from '@/lib/google-drive';
import { toPhoto } from '@/lib/photos';
import { authorize, deniedResponse } from '@/lib/require-access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/photos/[id]
 * Metadatos públicos de una foto concreta.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive no está configurado.' }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Falta el identificador de la foto.' }, { status: 400 });
  }

  try {
    const file = await getPhotoMetadata(id);
    return NextResponse.json({ photo: toPhoto(file) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Error al obtener metadatos de ${id}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/photos/[id]
 * Elimina permanentemente una foto de Google Drive. Solo administradores.
 *
 * Es una operación irreversible sobre el Drive de los novios, así que pide
 * `admin` y no `upload`. Que el proxy proteja `/admin` no sirve aquí: esta ruta
 * está fuera de él y es alcanzable directamente por su URL.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await authorize('admin');
  if (denied) return deniedResponse(denied);

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Falta el identificador de la foto.' }, { status: 400 });
  }

  try {
    await deletePhoto(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Error al eliminar la foto ${id}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
