import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isDriveConfigured, listFolders } from '@/lib/google-drive';
import type { DriveFolder } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/drive/folders
 * Lista las subcarpetas de la carpeta principal. Solo administradores.
 * Query opcional: `parentId`.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive no está configurado.' }, { status: 503 });
  }

  const parentId = request.nextUrl.searchParams.get('parentId') || undefined;

  try {
    const folders: DriveFolder[] = (await listFolders(parentId)).map((folder) => ({
      id: folder.id,
      name: folder.name,
    }));

    return NextResponse.json({ folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en GET /api/drive/folders:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
