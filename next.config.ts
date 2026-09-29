import type { NextConfig } from "next";

/**
 * Los binarios de `sharp` son específicos de cada plataforma: en el
 * repositorio se instala `@img/sharp-win32-x64` y Vercel compila para Linux,
 * donde hace falta `@img/sharp-linux-x64`. Sin el trazado explícito, la
 * función que redimensiona las fotos sube sin su binario y revienta al
 * importar `sharp`.
 *
 * Solo se aplica en builds de Linux (Vercel, Docker, un servidor Linux). En
 * desarrollo local el `sharp` instalado ya es el correcto para la máquina, y
 * forzar un glob que no existe solo daría warnings.
 */
const sharpPlatform = process.arch === "arm64" ? "linux-arm64" : "linux-x64";

const nextConfig: NextConfig = {
  ...(process.platform === "linux"
    ? {
        outputFileTracingIncludes: {
          // Única ruta que importa `sharp`.
          "/api/photos/[id]/raw": [
            `./node_modules/@img/sharp-${sharpPlatform}/**/*`,
            `./node_modules/@img/sharp-libvips-${sharpPlatform}/**/*`,
          ],
        },
      }
    : {}),
};

export default nextConfig;
