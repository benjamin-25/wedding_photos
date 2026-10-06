import 'server-only';

import { getAdminEmails } from '@/lib/env';

/**
 * Quién puede hacer qué, y el único sitio donde se decide.
 *
 * La comprobación se reparte entre páginas, Route Handlers y el login, y eso
 * convierte a este archivo en el punto crítico del proyecto: si el rol se
 * volviera a calcular en cada sitio, acabarían existiendo dos versiones de la
 * regla y aparecerían permisos que nadie ha concedido. Aquí solo hay una.
 *
 * La regla, en dos frases:
 *
 * - **Entrar y subir fotos es libre**: cualquier cuenta de Google con email
 *   obtiene el rol `uploader`. Los invitados no necesitan estar en ninguna
 *   lista para compartir sus fotos.
 * - **Gestionar la galería es de los novios**: el rol `admin` solo lo da
 *   `ADMIN_EMAIL`, y con él vienen el borrado, la descarga completa y el panel.
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

/**
 * Los roles de una cuenta, vacíos si no tiene ninguno.
 *
 * Con email hay `uploader` siempre; `admin` se suma si la cuenta figura en
 * `ADMIN_EMAIL`. Una cuenta puede tener los dos: los administradores también
 * suben fotos. La comparación es sobre el valor ya normalizado y la lista
 * también lo está, para que `Tatiana@Gmail.com` en la variable case a la
 * misma cuenta que `tatiana@gmail.com` en la sesión.
 *
 * Sin email no hay roles: no hay forma de saber qué cuenta es, y subir fotos
 * a nombre de nadie no es un permiso que quepa conceder.
 */
export function getRoles(email: string | null | undefined): Role[] {
  const value = normalize(email);
  if (!value) return [];

  const roles: Role[] = [];
  if (getAdminEmails()?.includes(value)) roles.push('admin');
  roles.push('uploader');

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
 * acordarse de comprobar los dos roles. En la práctica basta con que la
 * sesión traiga email: esa es toda la condición para subir.
 */
export function canUpload(email: string | null | undefined): boolean {
  return getRoles(email).includes('uploader');
}
