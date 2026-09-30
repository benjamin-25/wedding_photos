import { CREDITS_CONFIG } from '@/lib/constants';
import type { SocialIconName } from '@/lib/constants';
import styles from './footer.module.css';

/**
 * Iconos de las redes, dibujados en línea para no depender de una librería
 * externa ni de ficheros de imagen. Todos ocupan la misma caja de 24x24 y se
 * rellenan con `currentColor`, así que heredan el color del texto y funcionan
 * en modo claro y oscuro sin tocar nada.
 */
const ICON_PATHS: Record<SocialIconName, string> = {
  linkedin:
    'M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.03-1.86-3.03-1.85 0-2.13 1.44-2.13 2.94v5.66H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.23 0z',
  github:
    'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z',
  instagram:
    'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.71-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.71 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z',
  x: 'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23zm-1.16 17.52h1.83L5.01 4.13H3.05l14.03 15.64z',
  email:
    'M2 5.5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-13zm2.5-.5L12 11.6 19.5 5H4.5zM21 7.9l-8.2 6.1a1 1 0 0 1-1.2 0L3.5 7.9V18h17V7.9z',
};

function SocialIcon({ name }: { name: SocialIconName }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}

/**
 * Enlace externo. Se abre en pestaña nueva y lleva `rel="noopener noreferrer"`
 * para que la página destino no pueda acceder a la ventana original.
 */
function ExternalLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/**
 * Pie de página con los créditos de creación: logotipo, autor, redes sociales
 * y sitio web. Todos los datos salen de `CREDITS_CONFIG` en `lib/constants.ts`.
 */
export function Footer() {
  const { author, role, logo, website, socials } = CREDITS_CONFIG;
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src={logo} alt={`Logotipo de ${author}`} />
          <div className={styles.brandText}>
            <p className={styles.author}>Desarrollado por {author}</p>
            <p className={styles.role}>{role}</p>
          </div>
        </div>

        <div className={styles.links}>
          <ul className={styles.socials}>
            {socials.map((social) => (
              <li key={social.icon}>
                <ExternalLink
                  href={social.href}
                  className={styles.link}
                  ariaLabel={`${author} en ${social.label}`}
                >
                  <SocialIcon name={social.icon} />
                  <span>{social.label}</span>
                </ExternalLink>
              </li>
            ))}
            <li>
              <ExternalLink
                href={website.href}
                className={styles.link}
                ariaLabel={`Sitio web de ${author}`}
              >
                <svg
                  className={styles.icon}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm6.9 6h-2.9a15.6 15.6 0 0 0-1.4-3.6A10 10 0 0 1 18.9 6zM12 3.6c.7 1 1.3 2.2 1.7 3.6h-3.4c.4-1.4 1-2.6 1.7-3.6zM4.3 18a10 10 0 0 1 0-12c.4-.6.9-1.2 1.4-1.7A15.6 15.6 0 0 0 7.1 6H4.3A12 12 0 0 0 12 20a11.8 11.8 0 0 1-1.9-.2 10 10 0 0 1-5.8-1.8zM4.3 18h2.8a15.6 15.6 0 0 0 1.4 3.6A10 10 0 0 1 3.1 18a10 10 0 0 1 1.2 0zm0-6h2.8c.1 1 .3 2 .6 3H4.3a10 10 0 0 1 0-3zm9.7 9c-.7-1-1.3-2.2-1.7-3.6h3.4c-.4 1.4-1 2.6-1.7 3.6zm1.8-6.6H9.2a15 15 0 0 1 0-3.4h6.6a15 15 0 0 1 0 3.4zm.2 6.2a15.6 15.6 0 0 0 1.4-3.6h2.8a10 10 0 0 1-4.2 3.6zm1.7-6.2a15 15 0 0 0-.6-3h2.8a10 10 0 0 1 0 3h-2.2z"
                    fill="currentColor"
                  />
                </svg>
                <span>{website.label}</span>
              </ExternalLink>
            </li>
          </ul>
          <p className={styles.copyright}>
            © {year} {author}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
