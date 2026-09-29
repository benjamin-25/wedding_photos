import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { WEDDING_CONFIG } from '@/lib/constants';
import './globals.css';

// Serif para los títulos (Playfair Display) y sans para el texto (Inter),
// según la guía de diseño del proyecto.
const playfair = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: WEDDING_CONFIG.title,
    template: `%s · ${WEDDING_CONFIG.title}`,
  },
  description:
    'Galería fotográfica de la boda. Sube tus fotos y comparte los recuerdos con todos los invitados.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${playfair.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
