import { Readable } from 'stream';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_CONFIG, isPhotoSize } from '@/lib/constants';
import type { PhotoSize } from '@/lib/constants';
import { getPhotoStream, isDriveConfigured } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/** Ancho máximo y calidad de cada variante servida. */
const VARIANTS: Record<Exclude<PhotoSize, 'full'>, { width: number; quality: number }> = {
  thumb: { width: APP_CONFIG.THUMBNAIL_SIZE, quality: APP_CONFIG.THUMBNAIL_QUALITY },
  medium: { width: APP_CONFIG.MEDIUM_SIZE, quality: APP_CONFIG.MEDIUM_QUALITY },
};

/**
 * Convierte un stream de Node en un Uint8Array.
 * Los archivos están limitados a 25 MB, así que caben en memoria de sobra.
 */
async function toBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Redimensiona la imagen. Si sharp no puede decodificarla (por ejemplo HEIC en
 * una build sin soporte HEIF) se devuelve el original tal cual, de modo que la
 * foto siempre se ve aunque no se pueda redimensionar.
 */
async function resize(
  buffer: Buffer,
  variant: Exclude<PhotoSize, 'full'>
): Promise<Blob> {
  const { width, quality } = VARIANTS[variant];

  try {
    const output = await sharp(buffer)
      .rotate() // respeta la orientación EXIF antes de reducir
      .resize({ width, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    return new Blob([new Uint8Array(output)], { type: 'image/jpeg' });
  } catch (error) {
    console.warn(
      `[raw] No se pudo redimensionar a ${variant}, se sirve el original: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // Se devuelve el original para que la foto siga viéndose.
    return new Blob([new Uint8Array(buffer)]);
  }
}

/**
 * GET /api/photos/[id]/raw
 * Sirve la foto haciendo de proxy con la cuenta de servicio. Es la única vía
 * por la que el navegador ve las imágenes, de modo que el Drive puede
 * permanecer privado.
 *
 * `?size=thumb|medium|full` (por defecto `full`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive no está configurado.' }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Falta el identificador de la foto.' }, { status: 400 });
  }

  const requested = request.nextUrl.searchParams.get('size');
  const size: PhotoSize = isPhotoSize(requested) ? requested : 'full';

  try {
    const { stream, mimeType, size: byteSize } = await getPhotoStream(id);

    // `full` va en streaming: no se carga la imagen en memoria.
    if (size === 'full') {
      const body = Readable.toWeb(stream as Readable) as ReadableStream;

      return new Response(body, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': byteSize,
          // Los IDs de Drive son inmutables: se puede cachear sin riesgo.
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Photo-Size': size,
        },
      });
    }

    const original = await toBuffer(stream);
    const body = await resize(original, size);

    return new Response(body, {
      headers: {
        'Content-Type': body.type || 'image/jpeg',
        'Content-Length': String(body.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Photo-Size': size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Error al servir la foto ${id}:`, error);
    return NextResponse.json(
      { error: `No se pudo obtener la foto: ${message}`, id, size },
      { status: 500 }
    );
  }
}
