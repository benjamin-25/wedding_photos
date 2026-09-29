export const APP_CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
  MAX_CONCURRENT_UPLOADS: 3,
  PHOTOS_PER_PAGE: 24,
  THUMBNAIL_SIZE: 400,
  MEDIUM_SIZE: 1200,
  // Calidad JPEG de las variantes redimensionadas servidas por /raw.
  THUMBNAIL_QUALITY: 70,
  MEDIUM_QUALITY: 82,
  // Límite de archivos por descarga ZIP para no agotar la memoria del proceso.
  MAX_DOWNLOAD_PHOTOS: 200,
} as const;

export const PHOTO_SIZES = ['thumb', 'medium', 'full'] as const;
export type PhotoSize = (typeof PHOTO_SIZES)[number];

export function isPhotoSize(value: string | null | undefined): value is PhotoSize {
  return PHOTO_SIZES.includes(value as PhotoSize);
}

export const WEDDING_CONFIG = {
  title: process.env.NEXT_PUBLIC_WEDDING_TITLE || 'Nuestra Boda',
  date: process.env.NEXT_PUBLIC_WEDDING_DATE || '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

export const ROUTES = {
  HOME: '/',
  GALLERY: '/gallery',
  ADMIN: '/admin',
  LOGIN: '/login',
  API: {
    PHOTOS: '/api/photos',
    ALBUMS: '/api/photos/albums',
    PHOTO: (id: string) => `/api/photos/${id}`,
    PHOTO_RAW: (id: string, size: PhotoSize = 'full') =>
      `/api/photos/${id}/raw?size=${size}`,
    UPLOAD: '/api/photos/upload',
    DOWNLOAD: '/api/photos/download',
    FOLDERS: '/api/drive/folders',
    STATS: '/api/drive/stats',
  },
} as const;
