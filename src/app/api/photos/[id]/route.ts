import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deletePhoto, getPhotoMetadata, isDriveConfigured } from '@/lib/google-drive';
import { toPhoto } from '@/lib/photos';

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
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // El proxy solo cubre /admin, así que esta ruta se autoriza aquí.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

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
