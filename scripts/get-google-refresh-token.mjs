#!/usr/bin/env node
// Genera el refresh token de Google que usa la app para llamar a la API de
// Drive en nombre del administrador.
//
// Por qué hace falta: las Service Accounts no tienen cuota de almacenamiento
// ni pueden ser propietarias de un archivo, así que las subidas se rechazaban.
// Con OAuth la app usa la cuenta real del administrador y las fotos consumen su
// cuota (15 GB en una cuenta personal).
//
// Uso:
//   1. Registra http://localhost:8765 como URI de redirección autorizado en
//      el cliente OAuth de Google Cloud.
//   2. Rellena GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env.local.
//   3. node scripts/get-google-refresh-token.mjs
//
// El script imprime la línea `GOOGLE_REFRESH_TOKEN=...` para copiar en
// .env.local (y en las variables de entorno de Vercel).
//
// Requiere Node 18 o superior (usa fetch). No necesita ninguna dependencia:
// el intercambio del código por los tokens se hace contra el endpoint de
// Google directamente.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { exec } from 'node:child_process';

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function openBrowser(url) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];

  exec(`${command} ${args.map((a) => `"${a}"`).join(' ')}`, () => {
    // Si no se puede abrir el navegador no es un error: la URL también se
    // imprime por consola para poder abrirla a mano.
  });
}

async function exchangeCode(code) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `Google rechazó el canje del código: ${body.error_description || body.error} (${response.status})`
    );
  }

  return body;
}

async function describeAccount(accessToken) {
  const response = await fetch(ABOUT_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  return response.json();
}

loadEnvLocal();

if (typeof fetch !== 'function') {
  console.error('Este script necesita Node 18 o superior (no encuentra `fetch`).');
  process.exit(1);
}

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env.local.');
  process.exit(1);
}

const authUrl = new URL(AUTH_URL);
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
// `offline` + `prompt=consent` son los que hacen que Google emita el refresh
// token. Sin ellos solo se obtiene un access token de una hora de duración.
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('include_granted_scopes', 'true');

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const finish = (html) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
    server.close();
  };

  if (error) {
    finish(
      `<h1>No se pudo iniciar sesión</h1><p>Google devolvió el error: ${error}</p>` +
        '<p>Comprueba que la cuenta está añadida como usuario de prueba en la pantalla de consentimiento.</p>'
    );
    return;
  }

  if (!code) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<h1>Esperando la respuesta de Google…</h1>');
    return;
  }

  exchangeCode(code)
    .then(async (tokens) => {
      if (!tokens.refresh_token) {
        throw new Error(
          'Google no devolvió un refresh token. Revisa que el cliente OAuth esté en modo producción o que la cuenta sea usuaria de prueba.'
        );
      }

      const about = await describeAccount(tokens.access_token);
      const account = about?.user?.emailAddress ?? '(desconocido)';
      const quota = about?.storageQuota
        ? `${Number(about.storageQuota.limit) / 1e9} GB`
        : '(sin datos)';

      console.log('');
      console.log(`  Cuenta conectada   : ${account}`);
      console.log(`  Cuota de Drive     : ${quota}`);
      console.log('');
      console.log('  Añade esta línea a .env.local (y a las variables de Vercel):');
      console.log('');
      console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('');

      finish(
        '<h1>Listo</h1><p>Copia el <code>GOOGLE_REFRESH_TOKEN</code> que aparece en la terminal ' +
          'en tu fichero <code>.env.local</code>. Ya puedes cerrar esta ventana.</p>'
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n  Error: ${err.message}\n`);
      finish(`<h1>Error</h1><p>${err.message}</p>`);
      process.exit(1);
    });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Autoriza el acceso a tu carpeta de fotos:');
  console.log('');
  console.log(`  ${authUrl.toString()}`);
  console.log('');
  console.log('  Se abrirá el navegador. Si no se abre, copia la URL de arriba.');
  console.log('');
  openBrowser(authUrl.toString());
});
