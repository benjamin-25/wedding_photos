# Galería de fotos de boda

Aplicación web para recoger las fotos de los invitados de una boda en un Google
Drive **privado**, y publicarlas en una galería con enlace y código QR.

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript
- **NextAuth v5** con login abierto mediante cuenta de Google: cualquier invitado sube fotos y `ADMIN_EMAIL` decide quién administra
- **Google Drive API v3** mediante OAuth 2.0 a nombre del administrador
- **sharp** para servir miniaturas y tamaños intermedios sin descargar el original
- **CSS Modules**, sin framework de estilos

Las fotos nunca se exponen directamente: el navegador pide las imágenes a
`/api/photos/:id/raw` y el servidor hace de proxy con las credenciales de
OAuth, de modo que el Drive puede permanecer completamente privado y las
credenciales no salen nunca al cliente.

Los invitados **no necesitan cuenta para ver ni descargar**: entran desde el
QR, eligen las fotos que quieren con las casillas y se las descargan en un
ZIP. Para **subir** fotos sí tienen que iniciar sesión con su cuenta de
Google; sirve cualquier cuenta.

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

Y las cuentas de Google que usarán la boda: no hay contraseña, el acceso se
hace con Google. Cualquier invitado puede entrar y subir fotos; el email (o
los emails) de `ADMIN_EMAIL` es el único que tendrá acceso al panel de
administración.

### 3. Configurar Google Drive con OAuth

> **Por qué OAuth y no una cuenta de servicio.** Una Service Account no tiene
> cuota de almacenamiento (`storageQuota.limit` es `0`) y Google no le permite
> ser propietaria de un archivo. Al subir una foto, la cuenta de servicio
> quedaba como propietaria y la API respondía `403 Service Accounts do not
> have storage quota`. Compartir una carpeta con ella solo funciona si la
> carpeta está en un dominio de **Google Workspace**; en una cuenta personal
> `@gmail.com` el archivo acaba en la "My Drive" de la cuenta de servicio, que
> no tiene espacio. Con OAuth la app usa tu cuenta real y las fotos consumen
> su cuota.

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita la **Google Drive API**.
3. En **APIs y servicios → Pantalla de consentimiento OAuth**, elige *External*,
   añade tu email como usuario de prueba y **publica la aplicación**. Mientras
   esté en modo *Testing*, Google caduca los refresh tokens a los 7 días y la
   app dejaría de poder leer y escribir en Drive.
4. En **APIs y servicios → Credenciales → Crear cliente OAuth 2.0**, elige
   *Aplicación web* y añade **los dos** URIs de redirección autorizados:

   | URI | Para qué |
   | --- | --- |
   | `http://localhost:8765` | El script `npm run drive:token` |
   | `http://localhost:3000/api/auth/callback/google` | El login con Google |

   Si falta el segundo, Google responde `Error 401: redirect_uri_mismatch` y el
   login nunca vuelve a la aplicación.
5. Copia el ID y el secreto del cliente en `.env.local`:

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

6. Genera el refresh token. Abre el navegador, autoriza el acceso y copia la
   línea que imprime:

```bash
npm run drive:token
```

```bash
GOOGLE_REFRESH_TOKEN=1//0eXXXXX
```

7. Abre la carpeta de destino en Drive y copia su identificador — es el último
   segmento de la URL (`https://drive.google.com/drive/folders/ESTE_ID`):

```bash
GOOGLE_DRIVE_FOLDER_ID=ESTE_ID
```

Las mismas credenciales (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`) sirven
para el login con Google y para las llamadas a la API, así que solo hay que
crear un cliente OAuth.

> En Vercel hay que añadir también `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
> `GOOGLE_REFRESH_TOKEN` y `GOOGLE_DRIVE_FOLDER_ID` en *Settings → Environment
> Variables*, junto con `ADMIN_EMAIL` si quieres panel de administración. El
> refresh token es un secreto: no lo subas al repositorio.

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
| `npm run drive:token` | Genera el `GOOGLE_REFRESH_TOKEN` de Drive |

### 5. Iniciar sesión

Cualquier invitado entra en `/login` (o pulsa **Subir fotos** en la portada) y
sigue **Continuar con Google** con su cuenta: no hay lista de invitados, y en
`/upload` puede **subir fotos** arrastrándolas o seleccionándolas (hasta 50 por
envío).

Si su email figura en `ADMIN_EMAIL`, la portada le muestra además
**Administrar**, y desde `/admin` puede:

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
| `ADMIN_EMAIL` | No | Correos con acceso al panel. Sin ella, cualquiera sube fotos pero nadie administra. |
| `GOOGLE_CLIENT_ID` | Para la galería | ID del cliente OAuth 2.0. |
| `GOOGLE_CLIENT_SECRET` | Para la galería | Secreto del cliente OAuth 2.0. |
| `GOOGLE_REFRESH_TOKEN` | Para la galería | Refresh token de la cuenta de Google proprietaria de la carpeta. Se genera con `npm run drive:token`. |
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
| `/login` | Público | Inicio de sesión con Google (invitados y administración). |
| `/upload` | Con sesión | Panel de subida: cualquier cuenta de Google. |
| `/admin` | Administrador | QR, estadísticas, carpetas y borrado. |
| `/no-autorizado` | Con sesión | Aterrizaje de quien pide una zona a la que su cuenta no tiene acceso. |

La carpeta `/admin` y `/upload` están protegidas por `src/proxy.ts` (antes
`middleware.ts`), que solo comprueba que haya sesión: qué rol puede hacer qué
lo deciden cada página y cada ruta API.
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
| `POST` | `/api/photos/upload` | Con sesión | Sube archivos (`multipart/form-data`, campo `files`). |
| `POST` | `/api/photos/download` | Público | ZIP con las fotos indicadas en `{ "ids": [...] }`. |
| `GET` | `/api/photos/download` | Administrador | ZIP con todas las fotos. `?folderId=&limit=` |
| `GET` | `/api/drive/folders` | Administrador | Lista las subcarpetas. `?parentId=` |
| `GET` | `/api/drive/stats` | Con sesión | Total de fotos, espacio ocupado y carpeta. |

### Flujo de los invitados

La galería es pública y no necesita cuenta:

1. Entrar desde el QR o el enlace.
2. Explorar las fotos y, si hay subcarpetas en Drive, filtrar por álbum.
3. Marcar las que interesen con las casillas.
4. Pulsar **Descargar** en la barra flotante para recibirlas en un ZIP.

La descarga es pública a propósito: ver y descargar no exige cuenta. Para que
no se convierta en un endpoint que cualquiera pueda usar para generar ZIPs
masivos, cada petición está limitada a `MAX_DOWNLOAD_PHOTOS` (200) fotos y los
ficheros se piden de tres en tres. Si la galería es privada o tiene mucho tráfico,
ponla detrás de autenticación o añade limitación de tasa.

Quien quiera **subir** fotos entra con su cuenta de Google desde `/upload`:
cualquier cuenta sirve, y su subida aparece en la galería al instante.

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
├── auth.ts                  # Configuración de NextAuth v5 (login con Google)
├── app/
│   ├── page.tsx             # Portada
│   ├── gallery/             # Galería pública
│   ├── login/               # Acceso con Google
│   ├── admin/               # Panel privado
│   └── api/                 # Route Handlers
├── components/              # Grid, barra de selección, uploader, gestor, QR, carpetas
├── lib/
│   ├── google-drive.ts      # Cliente de la API de Drive (OAuth del administrador)
│   ├── constants.ts         # Rutas y límites
│   ├── photos.ts            # Mapeo Drive → Photo y utilidad de concurrencia
│   └── utils.ts             # Formato de tamaño y fecha
└── types/                   # Tipos compartidos
scripts/
└── get-google-refresh-token.mjs  # Genera GOOGLE_REFRESH_TOKEN
```

---

## Notas de la implementación

### `proxy.ts` y no `middleware.ts`

En Next.js 16 la convención `middleware` está **deprecada** y se ha renombrado a
`proxy`, que además usa el runtime de Node.js. Si añades un archivo
`middleware.ts`, Next.js seguirá funcionando pero con un aviso de deprecación.

### La identidad de Drive es la del administrador, no una cuenta de servicio

Una Service Account tiene `storageQuota.limit = 0` y no puede ser propietaria de
un archivo, así que toda subida fallaba con `403 Service Accounts do not have
storage quota`. La app se autentica con OAuth 2.0 usando la cuenta real del
administrador, y las fotos consumen su cuota.

Dos decisiones que se derivan de ahí:

- **El refresh token vive en `GOOGLE_REFRESH_TOKEN`, no en la sesión.** La
  galería la consultan invitados sin sesión, así que el cliente de Drive se
  construye siempre desde las variables de entorno. Además, un refresh token en
  la cookie de sesión es una credencial de largo alcance expuesta al cliente.
- **El alcance es `drive` completo, no `drive.file`.** `drive.file` solo da
  acceso a los ficheros que la propia aplicación crea o abre, así que las fotos
  que ya había en la carpeta desaparecerían de la galería.

`src/lib/google-drive.ts` cachea un cliente por refresh token. `googleapis`
renueva el access token de forma transparente cuando caduca (cada hora), así que
no hay que refrescar nada a mano.

### `scope` a mano sustituye los scopes OIDC del proveedor

El proveedor `Google` de Auth.js es de tipo `oidc` y saca el perfil del usuario
del `id_token`. Si en `authorization.params.scope` se pone solo el alcance de
Drive, se **sustituye** la lista por defecto del proveedor: Google no emite
`id_token`, el callback `signIn` recibe `user.email === undefined` y la cuenta
no puede subir fotos (es todo lo que hace falta para no tener ningún rol). Por
eso `GOOGLE_SCOPES` en `src/auth.ts` incluye `openid email profile`.

Relacionado: el login **no** pide `access_type=offline` ni `prompt=consent`.
El acceso a Drive no viene de la sesión, sino de `GOOGLE_REFRESH_TOKEN`, así que
no hace falta forzar la pantalla de consentimiento en cada entrada.

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
- `GOOGLE_REFRESH_TOKEN` es una credencial de largo alcance. En Vercel añádela
  como variable de entorno marcada como secreta; nunca la subas al repositorio.
- Si despliegas en **Vercel**, la subida de archivos de 25 MB puede superar el
  límite de 4,5 MB de las funciones serverless. Para archivos grandes, usa un
  servidor Node propio o aumenta el límite de tu plan.
- `maxDuration = 300` está configurado en las rutas de subida y descarga.

### Verificación con credenciales reales

`npm run build` no necesita credenciales de Google Drive, pero para comprobar la
integración completa necesitas un cliente OAuth y una carpeta reales. El script
`npm run drive:token` imprime la cuenta conectada y su cuota de Drive, así que
es la forma más rápida de confirmar que `GOOGLE_REFRESH_TOKEN` es válido.
