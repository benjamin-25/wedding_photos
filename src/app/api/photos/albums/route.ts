import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isDriveConfigured, listFolders, listPhotos } from '@/lib/google-drive';
import type { DriveFolder } from '@/types';

// Los álbumes son parte de la galería pública: cambia con cada subida.
export const dynamic = 'force-dynamic';

/**
 * GET /api/photos/albums
 * Lista pública de las subcarpetas de la carpeta principal, para que los
 * invitados puedan filtrar la galería por álbum.
 *
 * Solo se devuelven subcarpetas con al menos una foto, de modo que la carpeta
 * virtual "Todas" siempre tenga contenido.
 * Query opcional: `parentId`.
 */
export async function GET(request: NextRequest) {
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive no está configurado.' }, { status: 503 });
  }

  const parentId = request.nextUrl.searchParams.get('parentId') || undefined;

  try {
    const subfolders = await listFolders(parentId);

    // Solo hace falta saber si cada subcarpeta tiene alguna foto, así que se
    // pide `limit: 1`: una sola llamada barata por subcarpeta en lugar de
    // paginar el listado entero para contar.
    const withPhotos = await Promise.all(
      subfolders.map(async (folder) => {
        try {
          const { files } = await listPhotos(folder.id, undefined, 1);
          return { folder, hasPhotos: files.length > 0 };
        } catch {
          return { folder, hasPhotos: false };
        }
      })
    );

    // Se ocultan los álbumes vacíos: si no tienen fotos, el filtro no lleva a
    // ninguna parte.
    const albums: DriveFolder[] = withPhotos
      .filter((entry) => entry.hasPhotos)
      .map((entry) => ({ id: entry.folder.id, name: entry.folder.name }));

    return NextResponse.json({ albums }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Si falla el listado de subcarpetas no se rompe la galería: el filtro de
    // álbumes es opcional y la vista "Todas" sigue funcionando.
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en GET /api/photos/albums:', error);
    return NextResponse.json({ albums: [], warning: message }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
