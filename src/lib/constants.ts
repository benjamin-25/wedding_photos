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

export type SocialIconName = 'linkedin' | 'github' | 'instagram' | 'x' | 'email';

/**
 * Créditos del pie de página: quién lo hizo, sus redes y su web.
 *
 * Es lo primero que hay que editar para poner los datos reales. El logotipo
 * NO va aquí, es un fichero suelto en `public/`, al que apunta `logo`. Así se
 * puede cambiar por un PNG o por otro SVG sin tocar código: basta con
 * renombrar el fichero y cambiar la ruta.
 */
export const CREDITS_CONFIG = {
  /** Nombre o marca de quien ha desarrollado la aplicación. */
  author: 'Benjamin Paba',
  /** Frase corta bajo el nombre: a qué se dedica. */
  role: 'Desarrollo web a medida',
  /** Logotipo en `public/`. Fondo transparente. */
  logo: '/icon.png',
  /** Sitio web personal o del estudio. */
  website: {
    label: 'Sitio web',
    href: 'https://benjamin-25.github.io/landing-Benjamin.dev/',
  },
  /**
   * Redes sociales. `icon` decide el dibujo. Para quitar una red, borra su
   * línea entera; para añadirla, copia un ejemplo y cambia los tres campos.
   */
  socials: [
    { label: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com/in/benjamin-paba/' },
    { label: 'GitHub', icon: 'github', href: 'https://github.com/benjamin-25' },
  ] satisfies readonly { label: string; icon: SocialIconName; href: string }[],
} as const;

/**
 * Fotos de los novios con parallax en la portada (una a cada lado del hero).
 *
 * Las imágenes viven en `public/` y apuntan aquí. Para poner las fotos reales
 * basta con sobrescribir `public/novio.webp` y `public/novia.webp` con las
 * caras recortadas (las sirve el propio componente en forma de medallón
 * circular). Si prefieres otros nombres o un PNG, cambia solo `src`.
 */
export const COUPLE_CONFIG = {
  /** Velocidad del parallax: 0 = fija, 1 = se mueve como el contenido. */
  speed: 0.35,
  left: {
    src: '/novio-cara.webp',
    alt: 'Fotografía de Daniel',
  },
  right: {
    src: '/novia-cara.webp',
    alt: 'Fotografía de Tatiana',
  },
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
