import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Footer } from "@/components/footer";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${playfair.variable} ${inter.variable}`}
    >
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
