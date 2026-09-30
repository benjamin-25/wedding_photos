import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { canUpload, isAdmin } from '@/lib/access';

/**
 * El otro 401.
 *
 * `401` dice "tu sesión no vale": el cliente debería volver a pasar por Google.
 * `403` dice "tu sesión vale, pero no para esto", y reintentar no va a
 * arreglarlo. Confundir los dos hace que un uploader que llama a una ruta de
 * administrador vea un fallo de sesión y piense que Google le ha echado, cuando
 * lo que ha pasado es que esa operación nunca fue suya.
 *
 * Devolver un objeto con `ok: false` y `status` evita repetir el bloque
 * if/return en cada ruta y hace que el motivo quede en un solo sitio.
 */
export type AccessDenied = { ok: false; status: 401 | 403; message: string };

/**
 * Comprueba el acceso de la petición actual y devuelve la respuesta de error
 * si no lo tiene, o `null` si puede seguir.
 *
 * Cada ruta lo llama con lo que de verdad necesita, no con un chequeo genérico
 * de sesión. La decisión sale de `src/lib/access.ts`, que es el único sitio
 * donde vive la regla de qué puede hacer cada cuenta.
 */
export async function authorize(
  requires: 'admin' | 'upload'
): Promise<AccessDenied | null> {
  const session = await auth();
  const email = session?.user?.email;
  const allowed = requires === 'admin' ? isAdmin(email) : canUpload(email);

  if (allowed) return null;

  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      message: 'No hay sesión. Vuelve a iniciar sesión.',
    };
  }

  // El mensaje dice qué rol hace falta, no cuál es el tuyo: nombrar el rol
  // pedido ya le dice a quien lo lee si tiene el otro.
  const needed = requires === 'admin' ? 'administración' : 'subir fotos';

  console.warn(
    `[access] ${email} intentó una operación de ${needed} sin el rol necesario.`
  );

  return {
    ok: false,
    status: 403,
    message: 'Tu cuenta no tiene permiso para esta operación.',
  };
}

/** Atajo para responder el `AccessDenied` con su código correcto. */
export function deniedResponse(denied: AccessDenied): NextResponse {
  return NextResponse.json({ error: denied.message }, { status: denied.status });
}