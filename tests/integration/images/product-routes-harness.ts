// Harness of the photo integration tests (product, shop, upload, gallery and retouch routes): the
// identity is simulated at our three auth helpers, handlers are called directly, photos are read back
// from the database, and files of our store are recorded in the generated_images registry.
//
// vi.mock is hoisted only inside the file that declares it, so each test file declares the helpers
// its routes call, with the factories below:
//   vi.mock("@/lib/auth/server-auth", async () => (await import("./product-routes-harness")).serverAuthMock);
//   vi.mock("@/lib/boucher-auth", async () => (await import("./product-routes-harness")).boucherAuthMock);
//   vi.mock("@/lib/admin-auth", async () => (await import("./product-routes-harness")).adminAuthMock);
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { User } from "@prisma/client";
import { imageBlobHost } from "@/lib/images/durable-url";
import { buildUploadForm, type UploadPurpose } from "@/lib/images/upload-contract";
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
  getAuthenticatedBoucher: vi.fn(async () =>
    session.userId && session.shopId
      ? { userId: session.userId, shopId: session.shopId }
      : { error: new Response(null, { status: 401 }) }
  ),
};

export const adminAuthMock = {
  requireAdmin: vi.fn(async () =>
    session.role === "ADMIN" && session.clerkId !== null
      ? { userId: session.clerkId }
      : { error: new Response(null, { status: 403 }) }
  ),
};

/** Signs in as `identity` (null: signed out), the butcher of `shopId` when it is not null. */
export function actAs(
  identity: Pick<User, "id" | "clerkId" | "role"> | null,
  shopId: string | null
): void {
  session.clerkId = identity?.clerkId ?? null;
  session.userId = identity?.id ?? null;
  session.shopId = shopId;
  session.role = identity?.role;
}

/** The butcher of `shopId` without a user row: enough for routes that only ask the auth helpers. */
export function actAsButcherOf(shopId: string): void {
  actAs({ id: `user_${shopId}`, clerkId: `clerk_user_${shopId}`, role: "BOUCHER" }, shopId);
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

/** POST /api/uploads/image as the photo field sends it: buildUploadForm with a JPEG file. */
export function uploadRequest(bytes: Uint8Array, purpose: UploadPurpose): NextRequest {
  const file = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
  const form = buildUploadForm(file, purpose);
  return new NextRequest("http://localhost/api/uploads/image", { method: "POST", body: form });
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
    data: {
      model: "UPLOAD",
      prompt: "",
      usage: "PRODUCT",
      imageUrl,
      width: 800,
      height: 600,
      shopId,
      createdBy: "u",
    },
  });
  return imageUrl;
}

export type Photo = { url: string; order: number; isPrimary: boolean };

export async function photosOf(
  productId: string
): Promise<{ imageUrl: string | null; images: Photo[] }> {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: {
      imageUrl: true,
      images: { orderBy: { order: "asc" }, select: { url: true, order: true, isPrimary: true } },
    },
  });
}
