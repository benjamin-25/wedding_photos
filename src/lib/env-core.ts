import { accessSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

/**
 * Lectura y validación de las variables de entorno.
 *
 * Módulo de lógica pura, sin `import 'server-only'`: así lo pueden usar tanto
 * el servidor (`src/lib/env.ts`) como el script de diagnóstico
 * `npm run check:env`, que corre con Node pelado y no con el runtime de Next.
 * Quien importa desde la aplicación debe entrar por `src/lib/env.ts`.
 *
 * Existe por sí solo para centralizar cuatro cosas que, sueltas por el código,
 * hacían que las variables fallaran sin explicación visible:
 *
 * 1. **En el navegador las variables no existen.** Next.js solo expone al
 *    cliente las que llevan el prefijo `NEXT_PUBLIC_`; el resto se sustituye por
 *    `undefined` al compilar el bundle. Como `WEDDING_CONFIG` se construía al
 *    importar `src/lib/constants.ts` —módulo que usan tanto el servidor como
 *    los componentes de cliente—, el título y la `APP_URL` del código QR
 *    llegaban vacíos al navegador mientras las páginas sí los mostraban bien:
 *    la misma variable "a veces" existía y a veces no. Para leer estos valores
 *    en un componente de cliente hay que pasarlos como props desde el servidor.
 *
 * 2. **El valor llegaba sucio.** Una variable definida a mano desde PowerShell
 *    (`$env:APP_URL="https://x"`) incluye las comillas en el valor, y un espacio
 *    al final de la línea deja una URL inválida.
 *
 * 3. **Los valores de relleno se confundían con los reales.** Los de
 *    `.env.local.example` (`your-folder-id-from-google-drive`, `xxx@…`) están
 *    "definidos", así que la app arrancaba y luego Google respondía 401.
 *
 * 4. **Faltaba saber qué se había leído de verdad.** `describeEnv()` responde a
 *    eso, y es lo que imprime `npm run check:env`.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development';

/**
 * Ficheros donde Next.js busca las variables. El orden es el inverso al de
 * precedencia (gana el último), y replica `node_modules/next/dist/docs/01-app/
 * 02-guides/environment-variables.md`.
 */
const ENV_FILES = [
  '.env',
  `.env.${NODE_ENV}`,
  '.env.local',
  `.env.${NODE_ENV}.local`,
];

type EnvGroup = 'auth' | 'drive' | 'app' | 'cache';

interface VarSpec {
  /** Bloque de configuración, para agrupar el informe. */
  group: EnvGroup;
  /** No se imprime su valor al listar la configuración. */
  secret?: boolean;
  /**
   * La aplicación arranca sin ella y usa un valor por defecto. Solo entonces
   * `check:env` no la cuenta como problema: `APP_URL` y las de la caché, por
   * ejemplo, son ajustes y no bloquean nada.
   */
  optional?: boolean;
  /** Para qué sirve. Aparece en los mensajes de error y en el informe. */
  description: string;
}

/**
 * Catálogo de variables. Dar de alta aquí una variable nueva es lo que hace que
 * `check:env` la revise y que los errores de configuración la nombren.
 */
const VARS = {
  AUTH_SECRET: {
    group: 'auth',
    secret: true,
    description: 'Firma la sesión de Auth.js. Genera una con: openssl rand -base64 32',
  },
  ADMIN_EMAIL: {
    group: 'auth',
    optional: true,
    description: 'Única cuenta de Google con acceso al panel. Sin ella, entra cualquiera',
  },
  GOOGLE_CLIENT_ID: {
    group: 'drive',
    // El ID de cliente OAuth de una app web es público por diseño: aparece en
    // la barra de direcciones al autorizar. Ocultarlo solo estorba al depurar.
    description: 'ID del cliente OAuth 2.0 en Google Cloud',
  },
  GOOGLE_CLIENT_SECRET: {
    group: 'drive',
    secret: true,
    description: 'Secreto del cliente OAuth 2.0',
  },
  GOOGLE_REFRESH_TOKEN: {
    group: 'drive',
    secret: true,
    description: 'Token de refresco de la cuenta de Drive. Genera uno con: npm run drive:token',
  },
  GOOGLE_DRIVE_FOLDER_ID: {
    group: 'drive',
    description: 'ID de la carpeta de Drive donde se suben las fotos',
  },
  APP_URL: {
    group: 'app',
    optional: true,
    description: 'URL pública de la app. Es la que se codifica en el QR',
  },
  WEDDING_TITLE: {
    group: 'app',
    optional: true,
    description: 'Título de la boda, tal como se muestra en la portada',
  },
  WEDDING_DATE: {
    group: 'app',
    optional: true,
    description: 'Fecha de la boda en formato AAAA-MM-DD',
  },
  PHOTO_CACHE: {
    group: 'cache',
    optional: true,
    description: 'off desactiva la caché de imágenes en disco',
  },
  PHOTO_CACHE_DIR: {
    group: 'cache',
    optional: true,
    description: 'Directorio de la caché. Por defecto, el temporal del sistema',
  },
} as const satisfies Record<string, VarSpec>;

export type EnvVarName = keyof typeof VARS;

/**
 * El mismo catálogo con los tipos ampliados. `satisfies` conserva los tipos
 * literales de cada entrada, así que sin esto `SPECS[name].optional` no
 * compilaría en las variables que no lo declaran.
 */
const SPECS: Record<EnvVarName, VarSpec> = VARS;

const GROUP_LABELS: Record<EnvGroup, string> = {
  auth: 'Autenticación',
  drive: 'Google Drive',
  app: 'Aplicación',
  cache: 'Caché de imágenes',
};

/**
 * Valores de relleno que se entregan con `.env.local.example`. Chocan con
 * "está definida", así que se tratan como si no lo estuviera.
 */
const PLACEHOLDERS: RegExp[] = [
  /^your[-_]/i,
  /^(change[-_]?me|placeholder|pendiente|pendientes|todo|xxx)$/i,
  /example\.com/i,
];

export type EnvStatus = 'ok' | 'missing' | 'empty' | 'placeholder';

export interface EnvVarResult {
  name: EnvVarName;
  status: EnvStatus;
  /** Valor ya limpio. `undefined` si no se puede usar. */
  value?: string;
  /** `.env*` en el que está definida, si lo está. */
  source?: string;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDERS.some((pattern) => pattern.test(value));
}

/**
 * Si el valor de una variable es una credencial. Lo decide el `secret: true` del
 * catálogo, para que ningún informe acabe imprimiendo un refresh token.
 */
export function isSecretEnvVar(name: EnvVarName): boolean {
  return SPECS[name].secret === true;
}

/**
 * Si la aplicación arranca sin la variable. `check:env` lo usa para no marcar
 * como fallo algo que de verdad es un ajuste opcional.
 */
export function isOptionalEnvVar(name: EnvVarName): boolean {
  return SPECS[name].optional === true;
}

/**
 * Limpia el valor tal y como lo entrega `process.env`.
 *
 * Los espacios sobrantes son el caso fácil: `APP_URL=https://x ` deja una URL
 * inválida. Las comillas son el caso de Windows: al definir una variable desde
 * PowerShell (`$env:APP_URL="https://x"") forman parte del valor, y una URL que
 * empieza por comilla no se reconoce como tal.
 */
function normalize(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;

  let value = raw.trim();
  if (value === '') return undefined;

  const quoted = /^(['"`])([\s\S]*)\1$/.exec(value);
  if (quoted) value = quoted[2].trim();

  return value === '' ? undefined : value;
}

/**
 * Ruta de un fichero de configuración.
 *
 * `turbopackIgnore` es necesario porque el nombre del fichero sale de
 * `ENV_FILES` y no de un literal: sin la pista, Turbopack asume que el acceso
 * puede tocar cualquier ruta y acaba incluyendo **todo el proyecto** en el
 * trazado del despliegue. Aquí solo se leen cuatro `.env*` concretos, y solo
 * para el informe de diagnóstico, así que no deben formar parte de la salida.
 */
function fileAt(file: string): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), file);
}

function fileExists(file: string): boolean {
  try {
    accessSync(/* turbopackIgnore: true */ fileAt(file));
    return true;
  } catch {
    return false;
  }
}

/**
 * De qué `.env*` saldría cada variable. Permite distinguir "no está en ningún
 * fichero" de "la tienes en `.env.local` pero la está sobrescribiendo una
 * variable del sistema", que es una de las confusiones más habituales.
 */
function findSource(name: string): string | undefined {
  for (const file of ENV_FILES) {
    if (!fileExists(file)) continue;

    let contents: string;
    try {
      contents = readFileSync(/* turbopackIgnore: true */ fileAt(file), 'utf8');
    } catch {
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match?.[1] === name) return file;
    }
  }

  return undefined;
}

/**
 * Estado de una variable, distinguiendo por qué no se puede usar. Permite decir
 * "está definida pero vacía" en vez de un `undefined` sin explicación.
 */
export function inspectEnvVar(name: EnvVarName): EnvVarResult {
  const raw = process.env[name];

  if (raw === undefined) {
    return { name, status: 'missing' };
  }

  const value = normalize(raw);

  if (value === undefined) {
    return { name, status: 'empty', source: findSource(name) };
  }

  if (isPlaceholder(value)) {
    return { name, status: 'placeholder', value, source: findSource(name) };
  }

  return { name, status: 'ok', value, source: findSource(name) };
}

/**
 * Valor utilizable de una variable, o `undefined` si falta, está vacía o es un
 * relleno de ejemplo. Para el error con mensaje, usar `requireEnv`.
 */
export function getEnvVar(name: EnvVarName): string | undefined {
  const result = inspectEnvVar(name);
  return result.status === 'ok' ? result.value : undefined;
}

/** `ok` se incluye para que un estado nuevo no compile sin querer. */
function describeStatus(status: EnvStatus): string {
  switch (status) {
    case 'missing':
      return 'sin definir';
    case 'empty':
      return 'definida pero vacía';
    case 'placeholder':
      return 'sin cambiar: sigue el valor de ejemplo';
    case 'ok':
      return 'correcta';
  }
}
/**
 * Exige una variable y, si no sirve, lanza un error que dice cuál es, por qué
 * no vale y dónde se arregla. Sustituye a los `if (!x) throw new Error(...)`
 * repartidos por los módulos: el mensaje sale igual siempre y nombra el fichero.
 */
export function requireEnv(name: EnvVarName): string {
  const result = inspectEnvVar(name);
  const file = result.source ?? '.env.local';

  switch (result.status) {
    case 'ok':
      return result.value as string;
    case 'placeholder':
      throw new Error(
        `La variable ${name} sigue con el valor de ejemplo de .env.local.example. ` +
          `Edítala en ${file} y pon el valor real.`
      );
    case 'empty':
      throw new Error(
        `La variable ${name} está definida pero vacía en ${file}. ` +
          `Dale un valor o bórrala si no la usas.`
      );
    case 'missing':
      throw new Error(
        `Falta la variable ${name} (${SPECS[name].description}). ` +
          `Defínela en ${file} o en las variables de entorno del despliegue.`
      );
  }
}

const urlSchema = z.string().url().transform((value) => value.replace(/\/+$/, ''));

export interface WeddingConfig {
  title: string;
  date: string;
  /** Sin barra final, para poder concatenar rutas. Vacía si no se definió. */
  appUrl: string;
  /** URL absoluta de la galería. Vacía si no hay `APP_URL` válida. */
  galleryUrl: string;
  galleryPath: string;
}

/**
 * Datos públicos de la boda.
 *
 * Se leen **por llamada** y no al importar el módulo, para que una página
 * renderizada en cada petición vea los valores de ese momento y para que el
 * informe de diagnóstico no arrastre configuración.
 */
export function getWeddingConfig(): WeddingConfig {
  const title = getEnvVar('WEDDING_TITLE') ?? '';
  const date = getEnvVar('WEDDING_DATE') ?? '';
  const rawAppUrl = getEnvVar('APP_URL');
  const parsed = rawAppUrl ? urlSchema.safeParse(rawAppUrl) : null;
  const appUrl = parsed?.success ? parsed.data : '';

  if (rawAppUrl && !appUrl) {
    console.warn(
      `[env] APP_URL="${rawAppUrl}" no es una URL válida, así que el código QR de la galería ` +
        `llevará una ruta relativa. Debe ser algo como https://tu-dominio.com`
    );
  }

  const galleryPath = '/gallery';

  return {
    title,
    date,
    appUrl,
    galleryPath,
    galleryUrl: appUrl ? `${appUrl}${galleryPath}` : '',
  };
}

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

/**
 * Credenciales de Google Drive. Lanza si falta alguna, que es justo el momento
 * en que se van a usar: el resto de la aplicación sigue funcionando sin Drive.
 */
export function getDriveConfig(): DriveConfig {
  return {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refreshToken: requireEnv('GOOGLE_REFRESH_TOKEN'),
    folderId: getEnvVar('GOOGLE_DRIVE_FOLDER_ID') ?? '',
  };
}

/** Si Drive está listo para usarse, sin lanzar error cuando no lo está. */
export function isDriveConfigured(): boolean {
  return (
    getEnvVar('GOOGLE_CLIENT_ID') !== undefined &&
    getEnvVar('GOOGLE_CLIENT_SECRET') !== undefined &&
    getEnvVar('GOOGLE_REFRESH_TOKEN') !== undefined &&
    getEnvVar('GOOGLE_DRIVE_FOLDER_ID') !== undefined
  );
}

/**
 * Carpeta de Drive efectiva: la que pide la petición si la envía (el panel
 * permite cambiarla) y, si no, la de `GOOGLE_DRIVE_FOLDER_ID`.
 */
export function getDriveFolderId(requested?: string): string {
  return normalize(requested) ?? getEnvVar('GOOGLE_DRIVE_FOLDER_ID') ?? '';
}

/** Email autorizado a entrar al panel, en minúsculas. `null` si no se restringe. */
export function getAdminEmail(): string | null {
  return getEnvVar('ADMIN_EMAIL')?.toLowerCase() ?? null;
}

export interface PhotoCacheConfig {
  enabled: boolean;
  dir: string;
}

/**
 * Caché de imágenes en disco.
 *
 * `PHOTO_CACHE` acepta varias formas porque `off` era el único valor que la
 * apagaba, y es fácil escribirlo en mayúsculas o como `false`.
 */
export function getPhotoCacheConfig(): PhotoCacheConfig {
  const raw = getEnvVar('PHOTO_CACHE');

  return {
    enabled: raw === undefined || !/^(off|0|false|no)$/i.test(raw),
    dir: getEnvVar('PHOTO_CACHE_DIR') ?? path.join(os.tmpdir(), 'wedding-photo-cache'),
  };
}

export interface EnvReport {
  nodeEnv: string;
  envFiles: { file: string; exists: boolean }[];
  groups: { group: EnvGroup; label: string; vars: EnvVarResult[] }[];
  /** Variables obligatorias sin valor utilizable. Algo no va a funcionar. */
  problems: string[];
  /** Variables opcionales sin definir. La app arranca, pero no hace lo que se espera. */
  warnings: string[];
}

/**
 * Foto completa de la configuración tal y como la ve la app. La usan
 * `npm run check:env` y `GET /api/drive/env` para responder de una vez a por qué
 * una variable no está haciendo nada.
 */
export function describeEnv(): EnvReport {
  const groups = new Map<EnvGroup, EnvVarResult[]>();
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const name of Object.keys(VARS) as EnvVarName[]) {
    const result = inspectEnvVar(name);
    const bucket = groups.get(SPECS[name].group);

    if (bucket) bucket.push(result);
    else groups.set(SPECS[name].group, [result]);

    if (result.status === 'ok') continue;

    // Una variable opcional sin definir es el estado normal. Lo que nunca es
    // normal es una opcional definida con el valor de ejemplo: hay un `=` en
    // la línea, así que alguien la ha tocado y cree que está puesta.
    if (SPECS[name].optional && result.status === 'missing') continue;

    const line = `${result.name}: ${describeStatus(result.status)}`;
    if (SPECS[name].optional) warnings.push(line);
    else problems.push(line);
  }

  return {
    nodeEnv: NODE_ENV,
    envFiles: ENV_FILES.map((file) => ({ file, exists: fileExists(file) })),
    groups: [...groups].map(([group, vars]) => ({
      group,
      label: GROUP_LABELS[group],
      vars,
    })),
    problems,
    warnings,
  };
}

export type { EnvGroup };
