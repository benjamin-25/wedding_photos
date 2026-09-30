import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFolderStats, getFolderId, isDriveConfigured } from '@/lib/google-drive';
import { formatFileSize } from '@/lib/utils';
import type { AppStats } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/drive/stats
 * Resumen de la carpeta de fotos para el panel de administración.
 * Solo administradores.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

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
