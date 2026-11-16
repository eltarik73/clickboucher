// src/lib/services/shops/owner-write.ts — the one writer of the owner's changes to their shop
// (status, pause, busy mode, service settings, checklist). A suspended shop belongs to the admin
// until it is reactivated (moderation.ts): the condition sits in the UPDATE itself, so a suspension
// committed while the owner's request runs wins over its write.
import type { Prisma } from "@prisma/client";

export type OwnerShopWrite = { ok: true } | { ok: false; reason: "SUSPENDED" | "NOT_FOUND" };

/** Publication columns: written by the platform and the owner's vacation only, never here. */
type PublicationColumns = "visible" | "suspendedAt" | "suspendReason" | "validatedAt";

export async function writeOwnerShop(
  db: Pick<Prisma.TransactionClient, "shop">,
  shopId: string,
  data: Prisma.ShopUpdateManyMutationInput & Partial<Record<PublicationColumns, never>>
): Promise<OwnerShopWrite> {
  const { count } = await db.shop.updateMany({ where: { id: shopId, suspendedAt: null }, data });
  if (count === 1) return { ok: true };
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { suspendedAt: true } });
  return { ok: false, reason: shop ? "SUSPENDED" : "NOT_FOUND" };
}
