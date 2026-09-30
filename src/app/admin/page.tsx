import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/access";
import { ROUTES } from "@/lib/constants";
import { getWeddingConfig } from "@/lib/env";
import AdminDashboard from "@/components/admin-dashboard";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Administración",
};

export default async function AdminPage() {
  // El proxy (`src/proxy.ts`) ya manda a /login a quien no tiene sesión, así que
  // llegar aquí sin sesión solo puede pasar si el proxy cambia. Se comprueba
  // igualmente: el panel expone el botón de borrar fotos y la descarga completa.
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    redirect(ROUTES.UNAUTHORIZED);
  }

  const { title, appUrl, galleryPath } = getWeddingConfig();

  // El QR necesita una URL absoluta. Con `APP_URL` sin definir o inválida se cae
  // al dominio de la petición, que en local es la IP de la máquina y por eso los
  // invitados tienen que usar esa misma red. Se leen las cabeceras siempre, y no
  // solo en el `else`: si el origen se consultedara únicamente cuando falta
  // `APP_URL`, la página se prerenderizaría en `next build` con la configuración
  // de ese momento, que es justo lo que hace que `APP_URL` "no se aplique".
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = appUrl || `${proto}://${host}`;

  // Server Action en línea, no un `onClick`.
  //
  // Esta página es un Server Component, así que no puede llevar manejadores de
  // eventos: una función no viaja de servidor a navegador, y de ahí el error
  // "Event handlers cannot be passed to Client Component props". Con un
  // `<form action>`, en cambio, el HTML solo manda un POST y el servidor ejecuta
  // la acción, que además funciona sin JavaScript.
  async function logOut() {
    "use server";
    await signOut({ redirectTo: ROUTES.HOME });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de la boda</h1>
          <p className={styles.subtitle}>{title}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className="btn btn-ghost" href={ROUTES.GALLERY}>
            Ver galería
          </Link>
          <Link className="btn btn-ghost" href={ROUTES.HOME}>
            Inicio
          </Link>
          <form action={logOut}>
            <button className="btn btn-ghost" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <AdminDashboard title={title} galleryUrl={`${origin}${galleryPath}`} />
    </main>
  );
}
