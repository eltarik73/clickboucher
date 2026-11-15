// Harnais des tests d'intégration des routes qui publient, suspendent ou rouvrent une boutique
// (C1-FAILLES-CRITIQUES). Seules la session Clerk et les transports sortants sont simulés :
// requireAdmin et getAuthenticatedBoucher tournent pour de vrai et lisent le rôle et la boutique
// en base. Les handlers sont appelés directement.
//
// Usage dans un fichier de test (les fabriques de vi.mock sont remontées avant les imports) :
//   vi.mock("@clerk/nextjs/server", async () => (await import("./shop-routes-harness")).clerkMock);
//   vi.mock("@/lib/auth/server-auth", async () => (await import("./shop-routes-harness")).serverAuthMock);
//   vi.mock("@/lib/email", async () => (await import("./shop-routes-harness")).emailMock);
//   vi.mock("@/lib/push", async () => (await import("./shop-routes-harness")).pushMock);
//   vi.mock("@/lib/whatsapp", async () => (await import("./shop-routes-harness")).whatsappMock);
import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { Prisma, Shop, User } from "@prisma/client";
import { prisma } from "../helpers/db";
import { createTestShop, createTestUser } from "../helpers/factories";

const session = { clerkId: null as string | null };

/** Clerk : la session courante ; currentUser sans rôle, requireAdmin lit donc le rôle en base. */
export const clerkMock = {
  auth: async () => ({ userId: session.clerkId }),
  currentUser: async () => (session.clerkId ? { id: session.clerkId, publicMetadata: {} } : null),
  clerkClient: async () => ({ users: { updateUserMetadata: async () => ({}) } }),
};

/** Hors mode test : l'identité est la session Clerk. */
export const serverAuthMock = {
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => session.clerkId,
  getTestRole: () => null,
  isTestActivated: () => false,
};

export const sendEmail = vi.fn(async (_to: string, _subject: string, _html: string) => true);
export const emailMock = { sendEmail };
export const pushMock = { sendPushNotification: vi.fn(async () => true) };
export const whatsappMock = {
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
};

export function actAs(user: User | null): void {
  session.clerkId = user?.clerkId ?? null;
}

export const createAdmin = () => createTestUser({ role: "ADMIN" });

/**
 * A shop and its owner (role BOUCHER). ownerId holds the owner's Clerk id, the form the approval
 * notification looks up, so a validation that runs notifies the owner.
 */
export async function ownedShop(
  overrides: Partial<Prisma.ShopUncheckedCreateInput> = {}
): Promise<{ owner: User; shop: Shop }> {
  const owner = await createTestUser({ role: "BOUCHER" });
  if (owner.clerkId === null) throw new Error("createTestUser pose toujours un clerkId");
  const shop = await createTestShop({ ...overrides, ownerId: owner.clerkId });
  return { owner, shop };
}

export type ApiBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, string[]> };
};
export type ApiResult = { status: number; body: ApiBody };

/** Calls a handler with a JSON body (PATCH by default) or none (GET by default). */
export async function call<P>(
  handler: (req: NextRequest, ctx: { params: P }) => Promise<Response>,
  params: P,
  body?: unknown,
  init: { method?: string; headers?: Record<string, string> } = {}
): Promise<ApiResult> {
  const request = new NextRequest("http://localhost/api/itest", {
    method: init.method ?? (body === undefined ? "GET" : "PATCH"),
    headers: { "content-type": "application/json", ...init.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

/** The refusal of an answer: status, code, message, as the screens read them. */
export const refusal = ({ status, body }: ApiResult) => ({
  status,
  code: body.error?.code,
  message: body.error?.message,
});

export const shopRow = (id: string) => prisma.shop.findUniqueOrThrow({ where: { id } });

export const auditTrail = (shopId: string) =>
  prisma.auditLog.findMany({
    where: { target: "Shop", targetId: shopId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { actorId: true, action: true, details: true },
  });
