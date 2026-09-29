import JSZip from 'jszip';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { APP_CONFIG, WEDDING_CONFIG } from '@/lib/constants';
import {
  getPhotoMetadata,
  getPhotoStream,
  isDriveConfigured,
  listPhotos,
} from '@/lib/google-drive';
import { mapWithConcurrency } from '@/lib/photos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(APP_CONFIG.MAX_DOWNLOAD_PHOTOS),
});

function sanitizeForZip(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'foto';
}

function buildSlug(): string {
  // NFD separa las vocales acentuadas de su marca combinante, que se elimina
  // para dejar un nombre de fichero limpio ("Nuestra Boda" -> "nuestra-boda").
  const slug = WEDDING_CONFIG.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug || 'boda';
}

/**
 * Añade cada foto al ZIP. Devuelve los errores por archivo para no abortar
 * todo el proceso si una sola imagen falla.
 */
async function addPhotosToZip(
  zip: JSZip,
  entries: { id: string; name: string }[]
): Promise<{ name: string; error: string }[]> {
  const failures: { name: string; error: string }[] = [];
  const usedNames = new Set<string>();

  await mapWithConcurrency(entries, APP_CONFIG.MAX_CONCURRENT_UPLOADS, async (file) => {
    try {
      const { stream, mimeType } = await getPhotoStream(file.id);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      // Evita colisiones de nombre dentro del ZIP (fotos con el mismo nombre).
      let name = sanitizeForZip(file.name);
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let counter = 2;
        while (usedNames.has(`${base}-${counter}${ext}`)) counter++;
        name = `${base}-${counter}${ext}`;
      }
      usedNames.add(name);

      // La extensión se toma del MIME real por si el nombre no la incluye.
      const hasExt = /\.[a-z0-9]{2,5}$/i.test(name);
      const finalName = hasExt ? name : `${name}.${mimeType.split('/')[1] || 'jpg'}`;

      usedNames.add(finalName);
      zip.file(finalName, Buffer.concat(chunks));
    } catch (error) {
      failures.push({
        name: file.name,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  });

  return failures;
}

function zipResponse(archive: Buffer, totalFiles: number): Response {
  const fileName = `${buildSlug()}-fotos-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(new Uint8Array(archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(archive.byteLength),
      'X-Total-Files': String(totalFiles),
    },
  });
}

/**
 * POST /api/photos/download
 * Descarga en un ZIP las fotos que el invitado ha seleccionado.
 * Cuerpo: `{ "ids": ["id1", "id2"] }`. Público a propósito: es el flujo de los
 * invitados, que no tienen cuenta.
 */
export async function POST(request: NextRequest) {
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive no está configurado.' }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Se esperaba un cuerpo JSON con la forma { "ids": [...] }.' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'La lista de fotos no es válida.', details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Se deduplican los ids conservando el orden de selección.
  const ids = [...new Set(parsed.data.ids)];

  try {
    // Se resuelven los nombres reales para que el ZIP descargado tenga nombres
    // legibles en lugar de ids de Drive. Si un nombre no se puede resolver, se
    // cae al id y la foto sigue descargándose.
    const named = await mapWithConcurrency(
      ids,
      APP_CONFIG.MAX_CONCURRENT_UPLOADS,
      async (id) => {
        try {
          const file = await getPhotoMetadata(id);
          return { id, name: file.name || id };
        } catch {
          return { id, name: id };
        }
      }
    );

    const zip = new JSZip();
    const failures = await addPhotosToZip(zip, named);

    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Un ZIP sin ficheros sigue teniendo bytes (la cabecera), así que el
    // criterio correcto es que al menos una foto se haya podido incluir.
    if (failures.length === named.length) {
      return NextResponse.json(
        { error: 'No se pudo incluir ninguna foto en el ZIP.', failures },
        { status: 502 }
      );
    }

    return zipResponse(archive, named.length - failures.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en POST /api/photos/download:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/photos/download
 * Descarga en un ZIP todas las fotos de la carpeta. Solo administradores.
 * Query opcional: `folderId`, `limit`.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive no está configurado.' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const folderId = searchParams.get('folderId') || undefined;
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), APP_CONFIG.MAX_DOWNLOAD_PHOTOS)
    : APP_CONFIG.MAX_DOWNLOAD_PHOTOS;

  try {
    // Recorre todas las páginas de Drive para reunir el listado completo.
    const files: { id: string; name: string }[] = [];
    let pageToken: string | undefined;

    do {
      const { files: page, nextPageToken } = await listPhotos(folderId, pageToken, 100);
      for (const file of page) {
        if (file.id && files.length < limit) {
          files.push({ id: file.id, name: file.name || file.id });
        }
      }
      pageToken = nextPageToken;
    } while (pageToken && files.length < limit);

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No hay fotos para descargar en esa carpeta.' },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const failures = await addPhotosToZip(zip, files);

    if (failures.length === files.length) {
      return NextResponse.json(
        { error: 'No se pudo incluir ninguna foto en el ZIP.', failures },
        { status: 502 }
      );
    }

    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return zipResponse(archive, files.length - failures.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en GET /api/photos/download:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
