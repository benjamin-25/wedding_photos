import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';
import { ROUTES } from '@/lib/constants';

/**
 * Proxy de Next.js 16 (antes `middleware`). Protege las páginas del panel de
 * administración y redirige a `/login` conservando la URL de destino.
 *
 * La autorización de las rutas API NO se delega aquí: los Route Handlers
 * verifican la sesión por sí mismos, ya que el proxy se ejecuta aparte del
 * runtime de la aplicación.
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
  matcher: ['/admin/:path*'],
};
