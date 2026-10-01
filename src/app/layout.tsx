import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { getWeddingConfig } from "@/lib/env";
import "./globals.css";

// Serif para los títulos (Playfair Display) y sans para el texto (Inter),
// según la guía de diseño del proyecto.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

/**
 * `WEDDING_TITLE` se lee aquí y no en un `export const metadata` de nivel de
 * módulo: el layout se evalúa al arrancar el servidor, y un despliegue que
 * cambia la variable en el panel no llegaría a verse hasta el siguiente
 * despliegue. `generateMetadata` corre en cada petición.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { title } = getWeddingConfig();

  return {
    title: {
      default: title,
      template: `%s · ${title}`,
    },
    description:
      "Galería fotográfica de la boda. Sube tus fotos y comparte los recuerdos con todos los invitados.",
  };
}

/**
 * Fija `data-theme` en `<html>` antes de que se pinte nada.
 *
 * Va como script en línea y no en un `useEffect` del botón porque un efecto
 * corre tras la hidratación: el navegador ya habría pintado el tema del
 * servidor y el visitante vería un fogonazo claro antes de oscurecerse. Un
 * `<script>` en línea se ejecuta de forma síncrona mientras se parsea el HTML.
 *
 * Se guarda la preferencia en `localStorage` en lugar de una cookie para no
 * tener que leer cookies en el layout, que sacaría la app del prerenderizado
 * estático. El `try/catch` cubre el modo privado, donde `localStorage` lanza.
 */
const THEME_INIT_SCRIPT = `(function(){try{const hour = new Date().getHours();document.documentElement.setAttribute('data-theme', hour >= 17 ? 'dark' : 'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `data-theme` es el valor por defecto que pinta el servidor; el script de
    // abajo lo corrige en el cliente, de ahí `suppressHydrationWarning`.
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${playfair.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Footer />
        <ThemeToggle />
      </body>
    </html>
  );
}
