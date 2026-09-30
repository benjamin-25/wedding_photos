import { NextResponse } from 'next/server';
import { describeEnv, isSecretEnvVar } from '@/lib/env';
import { authorize, deniedResponse } from '@/lib/require-access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/drive/env
 * Configuración tal y como la ve el servidor en este momento.
 *
 * Es la respuesta a "¿por qué esta variable no se está aplicando?". Un
 * `check:env` en local describe tu `.env.local`; esto describe el despliegue,
 * que es donde suelen aparecer las diferencias: variables que Vercel no tiene,
 * una que quedó en el valor de ejemplo, o un `.env.local` que sí está bien y en
 * producción no existe.
 *
 * Solo administradores, y los valores de las credenciales se ocultan: el
 * informe está pensado para poder pegarse en un chat sin filtrar un refresh
 * token. Sale con 503 si falta algo obligatorio, que es la forma de que un
 * health check detecte una configuración rota.
 */
export async function GET() {
  // Exige `admin` y no `upload` a propósito: este informe dice qué variables
  // están puestas en el despliegue, y aunque las credenciales salten, la lista
  // de correos autorizados no debería ser cosa de una cuenta de invitado.
  const denied = await authorize('admin');
  if (denied) return deniedResponse(denied);

  const report = describeEnv();

  const body = {
    ...report,
    groups: report.groups.map((group) => ({
      ...group,
      vars: group.vars.map((entry) => ({
        name: entry.name,
        status: entry.status,
        source: entry.source,
        // Longitud en lugar del valor: basta para distinguir un token corto de
        // uno truncado sin enseñarlo.
        value:
          entry.status === 'ok'
            ? isSecretEnvVar(entry.name)
              ? `(${entry.value?.length ?? 0} caracteres)`
              : entry.value
            : undefined,
      })),
    })),
  };

  return NextResponse.json(body, {
    status: report.problems.length > 0 ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
