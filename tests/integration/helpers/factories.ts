// Fabriques de lignes pour les tests d'intégration. Chaque fabrique insère une ligne valide avec
// des valeurs par défaut uniques ; les `overrides` l'emportent toujours. Elles n'écrivent que des
// colonnes obligatoires ou demandées par l'appelant : tout le reste garde la valeur par défaut de
// la base.
import type {
  Offer,
  Order,
  OrderItem,
  OrderStatus,
  Prisma,
  Product,
  Shop,
  User,
} from "@prisma/client";
import { prisma } from "./db";

// Compteur du worker : la base est vidée avant chaque test (useCleanDatabase), il suffit donc que
// les valeurs soient uniques à l'intérieur d'un fichier de test.
let sequence = 0;

function nextSequence(): number {
  sequence += 1;
  return sequence;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Role CLIENT, unique email and clerkId. */
export async function createTestUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {}
): Promise<User> {
  const n = nextSequence();
  return prisma.user.create({
    data: {
      clerkId: `user_itest_${n}`,
      email: `client-${n}@itest.klikandgo.test`,
      firstName: "Client",
      lastName: `Itest${n}`,
      role: "CLIENT",
      ...overrides,
    },
  });
}

/**
 * Status OPEN, autoAccept false. Creates its owner (role BOUCHER) and stores the owner's Prisma id
 * in ownerId, unless ownerId is given.
 */
export async function createTestShop(
  overrides: Partial<Prisma.ShopUncheckedCreateInput> = {}
): Promise<Shop> {
  const n = nextSequence();
  const ownerId = overrides.ownerId ?? (await createTestUser({ role: "BOUCHER" })).id;
  return prisma.shop.create({
    data: {
      slug: `boucherie-itest-${n}`,
      name: `Boucherie Itest ${n}`,
      address: `${n} rue des Tests`,
      city: "Chambéry",
      phone: "0400000000",
      status: "OPEN",
      autoAccept: false,
      ...overrides,
      ownerId,
    },
  });
}

/** Unit KG, priceCents 1911 (per kilogram), inStock true. */
export async function createTestProduct(
  shopId: string,
  overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}
): Promise<Product> {
  const n = nextSequence();
  return prisma.product.create({
    data: {
      shopId,
      name: `Produit itest ${n}`,
      unit: "KG",
      priceCents: 1911,
      inStock: true,
      ...overrides,
    },
  });
}

/**
 * PERCENT 10, payer KLIKGO (platform offer: no shop), ACTIVE, valid from yesterday to tomorrow,
 * unique code.
 */
export async function createTestOffer(
  overrides: Partial<Prisma.OfferUncheckedCreateInput> = {}
): Promise<Offer> {
  const n = nextSequence();
  const now = Date.now();
  return prisma.offer.create({
    data: {
      name: `Offre itest ${n}`,
      code: `ITEST${n}`,
      type: "PERCENT",
      discountValue: 10,
      payer: "KLIKGO",
      status: "ACTIVE",
      startDate: new Date(now - DAY_MS),
      endDate: new Date(now + DAY_MS),
      ...overrides,
    },
  });
}

type TestOrderItemInput = Partial<Prisma.OrderItemUncheckedCreateWithoutOrderInput> & {
  productId: string;
};

/**
 * Unique orderNumber "IT-<n>", status PENDING. Each item takes its name, unit and unit price from
 * its product (which must belong to the shop) and defaults to one sale unit: 1 kg stored as one
 * 1000 g portion for KG and TRANCHE, one piece or tray otherwise, so its total is the unit price.
 * An item override replaces that single column: when you change quantity or weightGrams, give the
 * matching totalCents. Order totalCents defaults to the sum of the item totals.
 * Precedence: defaults < status / totalCents < overrides.
 */
export async function createTestOrder(input: {
  shopId: string;
  userId: string;
  status?: OrderStatus;
  totalCents?: number;
  items?: TestOrderItemInput[];
  overrides?: Partial<Prisma.OrderUncheckedCreateInput>;
}): Promise<Order & { items: OrderItem[] }> {
  const n = nextSequence();
  const itemInputs = input.items ?? [];

  const products =
    itemInputs.length === 0
      ? []
      : await prisma.product.findMany({
          where: { shopId: input.shopId, id: { in: itemInputs.map((item) => item.productId) } },
          select: { id: true, name: true, unit: true, priceCents: true },
        });
  const productsById = new Map(products.map((product) => [product.id, product]));

  const items = itemInputs.map((item): Prisma.OrderItemUncheckedCreateWithoutOrderInput => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new Error(
        `createTestOrder : le produit ${item.productId} n'existe pas dans la boutique ${input.shopId}.`
      );
    }
    const weighed = product.unit === "KG" || product.unit === "TRANCHE";
    return {
      name: product.name,
      unit: product.unit,
      quantity: 1,
      weightGrams: weighed ? 1000 : null,
      priceCents: product.priceCents,
      totalCents: product.priceCents,
      ...item,
    };
  });

  return prisma.order.create({
    data: {
      orderNumber: `IT-${n}`,
      shopId: input.shopId,
      userId: input.userId,
      status: input.status ?? "PENDING",
      totalCents: input.totalCents ?? items.reduce((sum, item) => sum + item.totalCents, 0),
      items: { create: items },
      ...input.overrides,
    },
    include: { items: true },
  });
}
