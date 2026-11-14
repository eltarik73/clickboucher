// Harnais des tests d'intégration des routes produit et boutique (photos) : identité simulée par les
// helpers d'auth (seul simulacre permis), appel direct des handlers, lecture des photos en base et
// fichiers de notre magasin enregistrés dans le registre generated_images.
//
// Usage dans un fichier de test (les fabriques de vi.mock sont remontées avant les imports) :
//   vi.mock("@/lib/auth/server-auth", async () => (await import("./product-routes-harness")).serverAuthMock);
//   vi.mock("@/lib/boucher-auth", async () => (await import("./product-routes-harness")).boucherAuthMock);
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { imageBlobHost } from "@/lib/images/durable-url";
import { prisma } from "../helpers/db";

export const session = {
  clerkId: null as string | null,
  userId: null as string | null,
  shopId: null as string | null,
  role: undefined as string | undefined,
};

export const serverAuthMock = {
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => session.clerkId,
  resolveUserRole: async () => session.role,
  getTestRole: () => null,
  isTestActivated: () => false,
};

export const boucherAuthMock = {
  getAuthenticatedBoucher: async () =>
    session.userId && session.shopId
      ? { userId: session.userId, shopId: session.shopId }
      : { error: new Response(null, { status: 401 }) },
};

export function actAs(user: User, shopId: string | null): void {
  session.clerkId = user.clerkId;
  session.userId = user.id;
  session.shopId = shopId;
  session.role = user.role;
}

export type ApiBody = {
  data?: { id: string };
  error?: { code: string; message: string; details?: Record<string, string[]> };
};
export type Route = (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>;

export async function call(route: Route, path: string, method: string, body: unknown, id = "") {
  const request = new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await route(request, { params: { id } });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

/** URL d'un fichier de notre magasin Blob, sans ligne au registre (chemin donné, nom unique). */
export function storeUrl(folder: string): string {
  return `https://${imageBlobHost()}/${folder}/${randomUUID()}.webp`;
}

/**
 * Photo envoyée sur notre magasin et enregistrée au registre, comme le fait POST /api/uploads/image :
 * pour la boutique `shopId`, ou pour la plateforme quand shopId est null.
 */
export async function registeredPhoto(shopId: string | null): Promise<string> {
  const imageUrl = storeUrl(shopId === null ? "platform/reference" : `shops/${shopId}/product`);
  await prisma.generatedImage.create({
    data: { model: "UPLOAD", prompt: "", usage: "PRODUCT", imageUrl, width: 800, height: 600, shopId, createdBy: "u" },
  });
  return imageUrl;
}

export type Photo = { url: string; order: number; isPrimary: boolean };

export async function photosOf(productId: string): Promise<{ imageUrl: string | null; images: Photo[] }> {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: {
      imageUrl: true,
      images: { orderBy: { order: "asc" }, select: { url: true, order: true, isPrimary: true } },
    },
  });
}
