// src/lib/product-price-audience.ts — who is reading a shop's products, for the product endpoints.
//
// The rule (public, pro, manager) is the pure productPriceAudience of public-projections.ts; this
// module gathers its inputs from the request's identity and the database, once for both product
// routes (a list by shop, a product by id).
import prisma from "@/lib/prisma";
import { getBoucherOwnerUserId, getServerUserId } from "@/lib/auth/server-auth";
import { productPriceAudience, type ProductPriceAudience } from "@/lib/public-projections";

export type PriceAudienceTarget = { shopId: string } | { productId: string };

async function shopOwnerIdOf(target: PriceAudienceTarget): Promise<string | undefined> {
  if ("shopId" in target) {
    const shop = await prisma.shop.findUnique({
      where: { id: target.shopId },
      select: { ownerId: true },
    });
    return shop?.ownerId;
  }
  const product = await prisma.product.findUnique({
    where: { id: target.productId },
    select: { shop: { select: { ownerId: true } } },
  });
  return product?.shop.ownerId;
}

/** Audience of the caller for the products of the target's shop. Anonymous => PUBLIC, no lookup. */
export async function priceAudienceOf(target: PriceAudienceTarget): Promise<ProductPriceAudience> {
  const clerkId = await getServerUserId();
  if (!clerkId) return productPriceAudience(null);

  const [viewer, shopOwnerId, ownerUid] = await Promise.all([
    prisma.user.findUnique({ where: { clerkId }, select: { id: true, role: true } }),
    shopOwnerIdOf(target),
    getBoucherOwnerUserId(),
  ]);
  return productPriceAudience({
    role: viewer?.role,
    ids: [clerkId, viewer?.id, ownerUid],
    shopOwnerId,
  });
}
