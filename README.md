# Galería de fotos de boda

Aplicación web para recoger las fotos de los invitados de una boda en un Google
Drive **privado**, y publicarlas en una galería con enlace y código QR.

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript
- **NextAuth v5** con un único administrador validado por variables de entorno
- **Google Drive API v3** mediante cuenta de servicio
- **sharp** para servir miniaturas y tamaños intermedios sin descargar el original
- **CSS Modules**, sin framework de estilos

Las fotos nunca se exponen directamente: el navegador pide las imágenes a
`/api/photos/:id/raw` y el servidor hace de proxy con la cuenta de servicio, de
modo que el Drive puede permanecer completamente privado y las credenciales no
salen nunca al cliente.

Los invitados **no necesitan cuenta**: entran desde el QR, eligen las fotos que
quieren con las casillas y se las descargan en un ZIP.

---

## Puesta en marcha

### Requisitos

- **Node.js 20.9 o superior** (obligatorio: Next.js 16 no arranca con Node 18 ni anteriores)
- Una cuenta de Google con acceso a la carpeta donde se guardarán las fotos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar las variables de entorno

Copia el archivo de ejemplo y rellénalo:

```bash
cp .env.local.example .env.local
```

En Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

Genera el secreto de sesión:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Y el hash de la contraseña del administrador:

```bash
node -e "console.log(Buffer.from(require('bcryptjs').hashSync('tu-contraseña', 10)).toString('base64'))"
```

> **El hash va en Base64, no en crudo.** Next.js expande `$VARIABLE` al leer
> `.env.local`, y un hash bcrypt empieza por `$2b$10$...`. Escrito tal cual, la
> carga resolvería `$2b`, `$10` y `$<salt>` contra variables inexistentes y los
> borraría: el servidor recibiría un hash corrupto y el login fallaría sin
> mostrar ningún error. Usa siempre la variable `ADMIN_PASSWORD_HASH_B64`.

### 3. Configurar Google Drive

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita la **Google Drive API**.
3. Crea una **cuenta de servicio** y descarga su clave JSON.
4. Abre la carpeta de destino en Drive y compártela con el correo de la cuenta
   de servicio, con permiso de **editor**. Repite el paso en las subcarpetas.
5. Copia en `.env.local`:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=cuenta-de-servicio@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=id-de-la-carpeta
```

> La clave privada se pega entrecomillada y con los saltos de línea como `\n`.
> El código de `src/lib/google-drive.ts` los normaliza automáticamente, así que
> ambas formas funcionan.

Para obtener el `GOOGLE_DRIVE_FOLDER_ID`, abre la carpeta en el navegador: es el
último segmento de la URL (`https://drive.google.com/drive/folders/ESTE_ID`).

> La clave JSON y la API habilitada deben pertenecer **al mismo proyecto**. Si
> Google responde `Google Drive API has not been used in project ... before or
> it is disabled`, falta activar *Google Drive API* en
> [ese proyecto](https://console.cloud.google.com/apis/library/drive.googleapis.com)
> (tarda unos minutos en propagarse).

### 4. Arrancar

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm start` | Sirve la compilación de producción |
| `npm run lint` | ESLint |

### 5. Iniciar sesión

Entra en `/admin` con las credenciales de `ADMIN_EMAIL` y
`ADMIN_PASSWORD_HASH_B64`. Desde ahí puedes:

- **Subir fotos** arrastrándolas o seleccionándolas (hasta 50 por envío).
- **Ver el código QR** de la galería, elegir su tamaño y color, y descargarlo como
  PNG o SVG para imprimirlo.
- **Consultar la carpeta** de Drive y sus subcarpetas, y copiar su identificador.
- **Gestionar las fotos**: abrirlas, borrarlas una a una o en lote, y descargar un
  ZIP con todas.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `AUTH_SECRET` | En producción | Cifra la cookie de sesión. Generarla con `crypto.randomBytes(32)`. |
| `AUTH_TRUST_HOST` | No | Alternativa a `trustHost: true` (ya activado en `src/auth.ts`). |
| `ADMIN_EMAIL` | Sí | Email del administrador. |
| `ADMIN_PASSWORD_HASH_B64` | Sí | Hash bcrypt de la contraseña, **en Base64** (ver arriba). |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Para la galería | Email de la cuenta de servicio. |
| `GOOGLE_PRIVATE_KEY` | Para la galería | Clave privada de la cuenta de servicio. |
| `GOOGLE_DRIVE_FOLDER_ID` | Para la galería | Carpeta raíz de las fotos. |
| `NEXT_PUBLIC_APP_URL` | Recomendada | URL pública; se usa en el código QR. |
| `NEXT_PUBLIC_WEDDING_TITLE` | No | Título que aparece en la portada. |
| `NEXT_PUBLIC_WEDDING_DATE` | No | Fecha en formato `AAAA-MM-DD`. |

Sin las variables de Google Drive la aplicación **arranca igual**: la portada y
el panel funcionan, y la galería muestra un aviso de que falta configurarlas.

---

## Rutas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/` | Público | Portada con acceso a la galería. |
| `/gallery` | Público | Galería con scroll infinito, filtro por álbum, selección y ZIP. |
| `/login` | Público | Inicio de sesión del administrador. |
| `/admin` | Administrador | Subida de fotos, QR, estadísticas, carpetas y borrado. |

La carpeta `/admin` está protegida por `src/proxy.ts` (antes `middleware.ts`).
Las rutas API **verifican la sesión por sí mismas**, porque el proxy se ejecuta
aparte del runtime de la aplicación y no cubre las peticiones a `/api`.

### API

| Método | Endpoint | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/photos` | Público | Lista paginada. `?pageToken=&limit=&folderId=` |
| `GET` | `/api/photos/albums` | Público | Subcarpetas con fotos, para el filtro de la galería. `?parentId=` |
| `GET` | `/api/photos/:id` | Público | Metadatos de una foto. |
| `GET` | `/api/photos/:id/raw` | Público | Bytes de la imagen (proxy de Drive). `?size=thumb\|medium\|full` |
| `DELETE` | `/api/photos/:id` | Administrador | Elimina la foto de Drive. |
| `POST` | `/api/photos/upload` | Administrador | Sube archivos (`multipart/form-data`, campo `files`). |
| `POST` | `/api/photos/download` | Público | ZIP con las fotos indicadas en `{ "ids": [...] }`. |
| `GET` | `/api/photos/download` | Administrador | ZIP con todas las fotos. `?folderId=&limit=` |
| `GET` | `/api/drive/folders` | Administrador | Lista las subcarpetas. `?parentId=` |
| `GET` | `/api/drive/stats` | Administrador | Total de fotos, espacio ocupado y carpeta. |

### Flujo de los invitados

La galería es pública y no necesita cuenta:

1. Entrar desde el QR o el enlace.
2. Explorar las fotos y, si hay subcarpetas en Drive, filtrar por álbum.
3. Marcar las que interesen con las casillas.
4. Pulsar **Descargar** en la barra flotante para recibirlas en un ZIP.

La descarga es pública a propósito porque los invitados no tienen usuario. Para
que no se convierta en un endpoint que cualquiera pueda usar para generar ZIPs
masivos, cada petición está limitada a `MAX_DOWNLOAD_PHOTOS` (200) fotos y los
ficheros se piden de tres en tres. Si la galería es privada o tiene mucho tráfico,
ponla detrás de autenticación o añade limitación de tasa.

### Variantes de tamaño

`/api/photos/:id/raw?size=…` devuelve:

| Valor | Ancho máximo | Uso |
| --- | --- | --- |
| `thumb` | 400 px | La rejilla de la galería. |
| `medium` | 1200 px | Reservado para vistas intermedias. |
| `full` | original | El visor ampliado y la descarga. |

El redimensionado lo hace **sharp** en el servidor, respetando la orientación EXIF.
Si sharp no puede decodificar el archivo (por ejemplo un HEIC en una build sin
soporte HEIF), la ruta registra un aviso y sirve el original, de modo que la foto
siempre se ve.

Las fotos aceptadas son JPEG, PNG, WebP y HEIC/HEIF, de hasta **25 MB** cada una.

---

## Estructura

```
src/
├── proxy.ts                 # Protección de /admin (antes middleware.ts)
├── auth.ts                  # Configuración de NextAuth v5
├── app/
│   ├── page.tsx             # Portada
│   ├── gallery/             # Galería pública
│   ├── login/               # Formulario de acceso
│   ├── admin/               # Panel privado
│   └── api/                 # Route Handlers
├── components/              # Grid, barra de selección, uploader, gestor, QR, carpetas
├── lib/
│   ├── google-drive.ts      # Cliente de la API de Drive
│   ├── constants.ts         # Rutas y límites
│   ├── photos.ts            # Mapeo Drive → Photo y utilidad de concurrencia
│   └── utils.ts             # Formato de tamaño y fecha
└── types/                   # Tipos compartidos
```

---

## Notas de la implementación

### `proxy.ts` y no `middleware.ts`

En Next.js 16 la convención `middleware` está **deprecada** y se ha renombrado a
`proxy`, que además usa el runtime de Node.js. Si añades un archivo
`middleware.ts`, Next.js seguirá funcionando pero con un aviso de deprecación.

### El hash de la contraseña va en Base64

Next.js expande `$VARIABLE` al cargar `.env.local`. Un hash bcrypt tiene la forma
`$2b$10$<salt><hash>`, así que escrito en crudo la carga resuelve `$2b`, `$10` y
`$<salt>` contra variables que no existen y **los borra**: el hash llega corrupto
al servidor y el login falla con `CredentialsSignin` sin ningún aviso. Comillas
simples o dobles no ayudan. `src/auth.ts` decodifica `ADMIN_PASSWORD_HASH_B64` y
comprueba que el resultado parece un hash bcrypt antes de usarlo.

### `trustHost` en producción

Con `next start` fuera de Vercel, NextAuth rechaza el host con `UntrustedHost` y el
login devuelve 500. `src/auth.ts` activa `trustHost: true`, que es lo correcto
porque tanto Vercel como los proxies de producción reenvían el host original. Si
lo despliegas detrás de un proxy propio, asegúrate de que reenvía `X-Forwarded-Host`.

### Imágenes sin `next/image`

Las fotos se sirven desde una ruta propia de la API, no desde un dominio remoto
estable, así que se usan `<img>` con `loading="lazy"` y `decoding="async"`. Los
IDs de Drive son inmutables, por lo que la respuesta lleva
`Cache-Control: immutable` y el navegador no vuelve a pedir la misma foto.

La rejilla pide `size=thumb`, que el servidor reduce a 400 px con sharp. Así la
galería carga kilobytes en lugar de fotos de varios megapíxeles, sin que la ruta
tenga que devolver siempre el original.

### Descarga ZIP en memoria

Ambas variantes de `/api/photos/download` generan el ZIP completo en memoria. Por
eso `APP_CONFIG.MAX_DOWNLOAD_PHOTOS` limita las fotos por descarga (200 por
defecto); súbelo con cuidado según la memoria disponible en tu servidor.

Un ZIP sin ficheros tiene bytes de todos modos (la cabecera), así que el código
comprueba que al menos una foto se haya podido incluir antes de devolverlo; si
todas fallan, responde `502` con el detalle de los errores.

### Despliegue

- Requiere un runtime de **Node.js**, no un export estático: depende de la API de
  Drive y de la sesión.
- Si despliegas en **Vercel**, la subida de archivos de 25 MB puede superar el
  límite de 4,5 MB de las funciones serverless. Para archivos grandes, usa un
  servidor Node propio o aumenta el límite de tu plan.
- `maxDuration = 300` está configurado en las rutas de subida y descarga.

### Verificación con credenciales reales

`npm run build` no necesita credenciales de Google Drive, pero para comprobar la
integración completa necesitas una cuenta de servicio y una carpeta reales.
