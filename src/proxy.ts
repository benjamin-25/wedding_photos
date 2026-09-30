import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';
import { ROUTES } from '@/lib/constants';

/**
 * Proxy de Next.js 16 (antes `middleware`). Protege las páginas del panel de
 * administración y redirige a `/login` conservando la URL de destino.
 *
* Dos cosas que este fichero NO hace, a propósito:
 *
 * 1. No decide el rol. Solo pregunta si hay sesión. Quien entra a /admin sin
 *    ser administrador lo detecta la propia página y lo lleva a
 *    /no-autorizado. Poner aquí la comprobación de rol obligaría a mantener la
 *    misma regla en dos sitios, y es así como aparecen permisos que nadie ha
 *    concedido: uno de los dos se queda sin actualizar.
 * 2. No autoriza las rutas API. Los Route Handlers se comprueban por sí mismos
 *    con `src/lib/require-access.ts`, ya que el proxy se ejecuta aparte del
 *    runtime de la aplicación.
 */
export const proxy = auth((request: NextAuthRequest) => {
  if (!request.auth) {
    const loginUrl = new URL(ROUTES.LOGIN, request.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // `/upload` también va aquí: el panel de subida es parte de la administración.
  // `/api/photos/upload` comprueba la sesión por su cuenta, pero la página en sí
  // no debe ser accesible sin entrar.
  matcher: ['/admin/:path*', '/upload/:path*'],
};
