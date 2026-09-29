import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_CONFIG } from '@/lib/constants';
import { isDriveConfigured, listPhotos } from '@/lib/google-drive';
import { toPhoto } from '@/lib/photos';
import type { PhotoListResponse } from '@/types';

// La galería es pública y cambia con cada subida: nunca se cachea en build.
export const dynamic = 'force-dynamic';

/**
 * GET /api/photos
 * Lista pública de fotos de la carpeta configurada, con paginación por cursor.
 * Query: `pageToken`, `folderId`, `limit`.
 */
export async function GET(request: NextRequest) {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: 'Google Drive no está configurado. Revisa las variables de entorno.' },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const pageToken = searchParams.get('pageToken') || undefined;
  const folderId = searchParams.get('folderId') || undefined;
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : APP_CONFIG.PHOTOS_PER_PAGE;

  try {
    const { files, nextPageToken } = await listPhotos(folderId, pageToken, limit);

    const body: PhotoListResponse = {
      photos: files.map(toPhoto),
      nextPageToken,
      total: files.length,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en GET /api/photos:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
