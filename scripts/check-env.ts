/**
 * Informe de la configuración que la aplicación lee de verdad.
 *
 * Responde a la pregunta que más tiempo pierde al trabajar con `.env.local`:
 * ¿esta variable está definida, de dónde sale y por qué no se está usando?
 *
 * Corre con Node y con las mismas reglas que usa Next.js —`@next/env` es el
 * cargador con el que Next rellena `process.env` desde los ficheros `.env*`—, así
 * que lo que imprime es lo que la aplicación verá, no una lectura aparte.
 *
 *   npm run check:env
 *   npm run check:env -- --show-secrets
 *
 * Sale con código 1 si falta algo, para poder encadenarlo en un hook de git.
 */

import nextEnv from '@next/env';
import { describeEnv, isOptionalEnvVar, isSecretEnvVar } from '../src/lib/env-core.ts';
import type { EnvVarName } from '../src/lib/env-core.ts';

// `@next/env` es CommonJS, así que su `loadEnvConfig` llega por el export por
// defecto en vez de como named export.
const { loadEnvConfig } = nextEnv;

/** Poblamos `process.env` igual que hace Next antes de leer nada. */
loadEnvConfig(process.cwd());
const showSecrets = process.argv.includes('--show-secrets');

const report = describeEnv();

console.log(`\nEntorno: ${report.nodeEnv}`);

const present = report.envFiles.filter((entry) => entry.exists);
console.log(
  `Ficheros .env leídos: ${
    present.length ? present.map((entry) => entry.file).join(', ') : 'ninguno'
  }`
);

for (const group of report.groups) {
  console.log(`\n${group.label}`);

  for (const entry of group.vars) {
    const optional = isOptionalEnvVar(entry.name);
    const mark = entry.status === 'ok' ? '  ok  ' : optional ? ' aviso' : ' FALLO';
    const where = entry.source ? `  (${entry.source})` : '';
    const shown = entry.status === 'ok' ? `  ${preview(entry.name, entry.value ?? '')}` : '';

    console.log(`  ${mark} ${entry.name.padEnd(22)}${shown}${where}`);
  }
}

if (report.problems.length > 0) {
  console.log('\nProblemas:');

  for (const problem of report.problems) console.log(`  - ${problem}`);

  console.log('\nArregla lo anterior en .env.local y vuelve a ejecutar este comando.\n');
  process.exitCode = 1;
} else {
  console.log('\nSin problemas.');
}

if (report.warnings.length > 0) {
  console.log('\nAvisos (la app arranca, pero sin esto no hace lo que esperas):');

  for (const warning of report.warnings) console.log(`  - ${warning}`);
}

console.log('');

/**
 * Las credenciales no se imprimen enteras: de este informe se acaba haciendo
 * una captura para pegarla en un issue. `--show-secrets` las enseña.
 */
function preview(name: EnvVarName, value: string): string {
  if (showSecrets || !isSecretEnvVar(name)) return `= ${value}`;
  return `= (${value.length} caracteres, oculto)`;
}
