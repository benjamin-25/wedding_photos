import 'server-only';

import { getAdminEmails, getUploadEmails } from '@/lib/env';

/**
 * Quién puede hacer qué, y el único sitio donde se decide.
 *
 * La comprobación se reparte entre páginas, Route Handlers y el login, y eso
 * convierte a este archivo en el punto crítico del proyecto: si el rol se
 * volviera a calcular en cada sitio, acabarían existiendo dos versiones de la
 * regla y aparecerían permisos que nadie ha concedido. Aquí solo hay una.
 *
 * `uploader` existe para que una cuenta invitada pueda subir fotos sin poder
 * borrarlas ni llevarse la galería.
 */
export type Role = 'admin' | 'uploader';

/** Como `Role`, pero admits varias: 'admin' también puede usar /upload. */
export type AnyRole = Role | (Role | 'admin')[];

function normalize(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() ?? null;
}

/** Si hay alguna lista de correos definida, la aplicación está restringida. */
export function isRestricted(): boolean {
  return getAdminEmails() !== null || getUploadEmails() !== null;
}

/**
 * Los roles de una cuenta, vacíos si no tiene ninguno.
 *
 * Una cuenta puede estar en las dos listas; entonces tiene ambos roles. La
 * comparación es sobre el valor ya normalizado, y las listas también lo están,
 * para que `Tatiana@Gmail.com` en la variable case a la misma cuenta que
 * `tatiana@gmail.com` en la sesión.
 */
export function getRoles(email: string | null | undefined): Role[] {
  const value = normalize(email);
  if (!value) return [];

  const roles: Role[] = [];
  if (getAdminEmails()?.includes(value)) roles.push('admin');
  if (getUploadEmails()?.includes(value)) roles.push('uploader');

  return roles;
}

/** Si la cuenta puede entrar en el panel. */
export function isAdmin(email: string | null | undefined): boolean {
  return getRoles(email).includes('admin');
}

/**
 * Si la cuenta puede subir fotos o usar el panel.
 *
 * Se llama así y no `hasRole('uploader')` a propósito: un administrador
 * también sube fotos, y quiere que quien lea la ruta `/upload` no tenga que
 * acordarse de comprobar los dos roles.
 */
export function canUpload(email: string | null | undefined): boolean {
  return getRoles(email).length > 0;
}