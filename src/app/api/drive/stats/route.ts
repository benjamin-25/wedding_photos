import { NextResponse } from 'next/server';
import { getFolderStats, getFolderId, isDriveConfigured } from '@/lib/google-drive';
import { authorize, deniedResponse } from '@/lib/require-access';
import { formatFileSize } from '@/lib/utils';
import type { AppStats } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/drive/stats
 * Resumen de la carpeta de fotos para el panel de administración.
 * Solo administradores.
 */
export async function GET() {
  // Admite `upload` y no solo `admin`: el panel de subida también consulta estas
  // cifras para mostrar cuántas fotos hay. Devolver 403 a un uploader que está
  // en su propia pantalla lo dejaría viendo un error donde antes veía un número.
  const denied = await authorize('upload');
  if (denied) return deniedResponse(denied);

  if (!isDriveConfigured()) {
    const body: AppStats = {
      totalPhotos: 0,
      totalSize: '0 B',
      folderId: '',
      folderName: 'Sin configurar',
      driveConnected: false,
    };
    return NextResponse.json(body, { status: 200 });
  }

  try {
    const { totalPhotos, totalSize, folderName } = await getFolderStats();

    const body: AppStats = {
      totalPhotos,
      totalSize: formatFileSize(totalSize),
      folderId: getFolderId(),
      folderName,
      lastUpload: new Date().toISOString(),
      driveConnected: true,
    };

    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en GET /api/drive/stats:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
