import { google, drive_v3 } from 'googleapis';

/**
 * Cliente de Google Drive autenticado con OAuth 2.0 en nombre de una persona.
 * Módulo exclusivo del servidor para interactuar con la API v3 de Google Drive.
 *
 * Por qué OAuth y no una cuenta de servicio: una Service Account no tiene
 * cuota de almacenamiento propia (`storageQuota.limit` es 0) ni puede ser
 * propietaria de un archivo. Al crear una foto, la cuenta de servicio quedaba
 * como propietaria y Google rechazaba la subida con
 * "Service Accounts do not have storage quota". Autenticando con la cuenta
 * real del administrador, las fotos se guardan en su Drive y consumen su cuota.
 *
 * La identidad vive en `GOOGLE_REFRESH_TOKEN`, no en la sesión: la galería
 * pública la consultan invitados sin sesión, así que el cliente se construye
 * siempre a partir de las variables de entorno.
 */

// Un cliente por refresh token. La librería renueva el access token por su
// cuenta cuando caduca (1 hora), así que basta con conservar el cliente entre
// llamadas en lugar de renegociar uno nuevo en cada petición.
const driveClients = new Map<string, drive_v3.Drive>();

/**
 * Devuelve el refresh token que identifica al administrador de Drive.
 */
function getRefreshToken(): string {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!refreshToken) {
    throw new Error(
      'Configuración de Google Drive incompleta: falta GOOGLE_REFRESH_TOKEN en las variables de entorno. ' +
        'Genéralo con `npm run drive:token` siguiendo las instrucciones del README.'
    );
  }

  return refreshToken;
}

/**
 * Inicializa y devuelve el cliente de Google Drive utilizando las credenciales
 * OAuth configuradas en las variables de entorno.
 */
export function getDriveClient(): drive_v3.Drive {
  const refreshToken = getRefreshToken();

  const cached = driveClients.get(refreshToken);
  if (cached) {
    return cached;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Configuración de Google Drive incompleta: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en las variables de entorno'
    );
  }

  // El refresh token no se puede pasar al constructor: se inyecta con
  // `setCredentials`. Con él, googleapis pide un access token nuevo cada vez
  // que caduca el anterior, de forma transparente para el resto del módulo.
  const auth = new google.auth.OAuth2({ clientId, clientSecret });
  auth.setCredentials({ refresh_token: refreshToken });

  const client = google.drive({ version: 'v3', auth });
  driveClients.set(refreshToken, client);
  return client;
}

/**
 * Obtiene el ID de la carpeta desde el parámetro o desde la variable de entorno GOOGLE_DRIVE_FOLDER_ID.
 */
export function getFolderId(folderId?: string): string {
  return folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
}

/**
 * Verifica si las variables de entorno esenciales de Google Drive están configuradas.
 */
export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

/**
 * Interfaz para el resultado de listar fotos.
 */
export interface ListPhotosResult {
  files: drive_v3.Schema$File[];
  nextPageToken?: string;
}

/**
 * Lista fotos en una carpeta de Google Drive con soporte para paginación.
 */
export async function listPhotos(
  folderId?: string,
  pageToken?: string,
  pageSize: number = 24
): Promise<ListPhotosResult> {
  const drive = getDriveClient();
  const targetFolder = getFolderId(folderId);

  if (!targetFolder) {
    throw new Error('No se ha configurado GOOGLE_DRIVE_FOLDER_ID ni se proporcionó un ID de carpeta.');
  }

  const sanitizedFolder = targetFolder.replace(/'/g, "\\'");

  try {
    const response = await drive.files.list({
      q: `'${sanitizedFolder}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webContentLink)',
      pageSize,
      pageToken: pageToken || undefined,
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error al listar fotos en Google Drive:', error);
    throw new Error(`Fallo al listar fotos: ${message}`);
  }
}

/**
 * Interfaz para el resultado de subir una foto.
 */
export interface UploadPhotoResult {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

/**
 * Sube una fotografía a una carpeta especificada en Google Drive.
 */
export async function uploadPhoto(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId?: string
): Promise<UploadPhotoResult> {
  const drive = getDriveClient();
  const targetFolder = getFolderId(folderId);

  if (!targetFolder) {
    throw new Error('No se ha configurado una carpeta de destino para subir la foto.');
  }

  try {
    const { Readable } = await import('stream');
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolder],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, mimeType, size',
      supportsAllDrives: true,
    });

    return {
      id: response.data.id || '',
      name: response.data.name || fileName,
      mimeType: response.data.mimeType || mimeType,
      size: response.data.size || '0',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error al subir foto "${fileName}" a Google Drive:`, error);
    throw new Error(`Fallo al subir la foto "${fileName}": ${message}`);
  }
}

/**
 * Elimina una fotografía o archivo de Google Drive por su ID.
 */
export async function deletePhoto(fileId: string): Promise<void> {
  if (!fileId) {
    throw new Error('Se requiere el ID del archivo para eliminarlo.');
  }

  const drive = getDriveClient();

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error al eliminar el archivo ${fileId} de Google Drive:`, error);
    throw new Error(`Fallo al eliminar el archivo (${fileId}): ${message}`);
  }
}

/**
 * Interfaz para el stream y metadatos de una foto.
 */
export interface PhotoStreamResult {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  name: string;
  size: string;
}

/**
 * Obtiene el flujo de datos (stream) de una fotografía para proxying o descarga.
 */
export async function getPhotoStream(fileId: string): Promise<PhotoStreamResult> {
  if (!fileId) {
    throw new Error('Se requiere el ID del archivo para obtener el stream.');
  }

  const drive = getDriveClient();

  try {
    // Obtener primero los metadatos para conocer nombre, mimeType y tamaño
    const metaResponse = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size',
      supportsAllDrives: true,
    });

    // Obtener el contenido del archivo como stream
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    return {
      stream: response.data as unknown as NodeJS.ReadableStream,
      mimeType: metaResponse.data.mimeType || 'image/jpeg',
      name: metaResponse.data.name || 'photo',
      size: metaResponse.data.size || '0',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error al obtener stream del archivo ${fileId} en Google Drive:`, error);
    throw new Error(`Fallo al obtener stream del archivo (${fileId}): ${message}`);
  }
}

/**
 * Obtiene los metadatos completos de un archivo o fotografía en Google Drive.
 */
export async function getPhotoMetadata(fileId: string): Promise<drive_v3.Schema$File> {
  if (!fileId) {
    throw new Error('Se requiere el ID del archivo para obtener los metadatos.');
  }

  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webContentLink',
      supportsAllDrives: true,
    });
    return response.data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error al obtener metadatos del archivo ${fileId} en Google Drive:`, error);
    throw new Error(`Fallo al obtener metadatos del archivo (${fileId}): ${message}`);
  }
}

/**
 * Interfaz para las carpetas listadas.
 */
export interface FolderItem {
  id: string;
  name: string;
}

/**
 * Lista las subcarpetas dentro de una carpeta padre en Google Drive.
 */
export async function listFolders(parentFolderId?: string): Promise<FolderItem[]> {
  const drive = getDriveClient();
  const targetFolder = getFolderId(parentFolderId);

  if (!targetFolder) {
    throw new Error('No se ha configurado GOOGLE_DRIVE_FOLDER_ID ni se proporcionó un ID de carpeta.');
  }

  const sanitizedFolder = targetFolder.replace(/'/g, "\\'");

  try {
    const response = await drive.files.list({
      q: `'${sanitizedFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return (response.data.files || []).map((f) => ({
      id: f.id || '',
      name: f.name || '',
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error al listar subcarpetas en Google Drive:', error);
    throw new Error(`Fallo al listar subcarpetas: ${message}`);
  }
}

/**
 * Interfaz para las estadísticas de una carpeta.
 */
export interface FolderStatsResult {
  totalPhotos: number;
  totalSize: number;
  folderName: string;
}

/**
 * Obtiene información y estadísticas (conteo total de fotos y peso en bytes) de una carpeta.
 */
export async function getFolderStats(folderId?: string): Promise<FolderStatsResult> {
  const drive = getDriveClient();
  const targetFolder = getFolderId(folderId);

  if (!targetFolder) {
    throw new Error('No se ha configurado GOOGLE_DRIVE_FOLDER_ID ni se proporcionó un ID de carpeta.');
  }

  // Obtener nombre de la carpeta
  let folderName = 'Carpeta Principal';
  try {
    const folderResponse = await drive.files.get({
      fileId: targetFolder,
      fields: 'name',
      supportsAllDrives: true,
    });
    folderName = folderResponse.data.name || folderName;
  } catch (error) {
    console.warn(`No se pudo obtener el nombre de la carpeta (${targetFolder}), se utilizará el valor por defecto:`, error);
  }

  // Contar fotos y acumular tamaño total
  let totalPhotos = 0;
  let totalSize = 0;
  let pageToken: string | undefined;

  const sanitizedFolder = targetFolder.replace(/'/g, "\\'");

  try {
    do {
      const response = await drive.files.list({
        q: `'${sanitizedFolder}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'nextPageToken, files(size)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files || [];
      totalPhotos += files.length;
      totalSize += files.reduce((sum, f) => sum + parseInt(f.size || '0', 10), 0);
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return { totalPhotos, totalSize, folderName };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error al calcular estadísticas de la carpeta en Google Drive:', error);
    throw new Error(`Fallo al obtener estadísticas de la carpeta: ${message}`);
  }
}
