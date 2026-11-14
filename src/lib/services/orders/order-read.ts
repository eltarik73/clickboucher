// src/lib/services/orders/order-read.ts — the order rows the shop-side lists of GET /api/orders
// return (butcher and admin). Customers read src/lib/services/orders/customer-view.ts instead; the
// kitchen board reads its own narrower columns (src/lib/services/orders/kitchen.ts).
export const orderInclude = {
  items: {
    include: { product: { select: { name: true, unit: true, vatRate: true, imageUrl: true } } },
  },
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      address: true,
      city: true,
      siret: true,
      fullAddress: true,
      vatRate: true,
      priceAdjustmentThreshold: true,
    },
  },
  user: { select: { firstName: true, lastName: true, phone: true, loyaltyBadge: true } },
  priceAdjustment: true,
} as const;
