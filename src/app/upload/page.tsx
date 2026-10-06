import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { canUpload } from "@/lib/access";
import { ROUTES } from "@/lib/constants";
import { getWeddingConfig } from "@/lib/env";
import UploadPanel from "@/components/upload-panel";

export const metadata: Metadata = {
  title: "Subir fotos",
};

export default async function UploadPage() {
  // Sin esto la página se prerenderizaría en `next build` y el título se
  // congelaría con el `WEDDING_TITLE` que hubiera en ese momento.
  await connection();

  // Admite a cualquier cuenta con sesión, invitada o administradora: por eso
  // se llama `canUpload` y no se mira el rol `admin` uno a uno.
  const session = await auth();
  if (!canUpload(session?.user?.email)) {
    redirect(ROUTES.UNAUTHORIZED);
  }

  const { title } = getWeddingConfig();

  return <UploadPanel title={title} />;
}