// ═══════════════════════════════════════════════
// KLIK&GO — Seed V4 UBER EATS STYLE
// 10 boucheries halal + subscriptions + calendar
// + suggest rules + referrals + plan features
// ═══════════════════════════════════════════════

import { PrismaClient, Role, ProStatus, OrderStatus, Unit } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────

function varyPrice(baseCents: number): number {
  return Math.round(baseCents * (0.95 + Math.random() * 0.10));
}
function minutesFromNow(m: number): Date {
  return new Date(Date.now() + m * 60_000);
}
function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000);
}
function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86_400_000);
}

// ── Product images by category (local) ──
const PRODUCT_IMAGES: Record<string, string[]> = {
  boeuf: [
    "/img/products/boeuf-1.jpg",
    "/img/products/boeuf-2.jpg",
    "/img/products/boeuf-3.jpg",
    "/img/products/boeuf-4.jpg",
    "/img/products/boeuf-5.jpg",
  ],
  agneau: [
    "/img/products/agneau-1.jpg",
    "/img/products/agneau-2.jpg",
    "/img/products/agneau-3.jpg",
    "/img/products/agneau-4.jpg",
  ],
  volaille: [
    "/img/products/volaille-1.jpg",
    "/img/products/volaille-2.jpg",
    "/img/products/volaille-3.jpg",
    "/img/products/volaille-4.jpg",
  ],
  veau: [
    "/img/products/veau-1.jpg",
    "/img/products/veau-2.jpg",
  ],
  grillades: [
    "/img/products/grillades-1.jpg",
    "/img/products/grillades-2.jpg",
    "/img/products/grillades-3.jpg",
    "/img/products/grillades-4.jpg",
  ],
  preparations: [
    "/img/products/preparations-1.jpg",
    "/img/products/preparations-2.jpg",
  ],
  abats: [
    "/img/products/abats-1.jpg",
  ],
};

const SHOP_IMAGES: string[] = [
  "/img/shops/shop-1.jpg",
  "/img/shops/shop-2.jpg",
  "/img/shops/shop-3.jpg",
  "/img/shops/shop-4.jpg",
  "/img/shops/shop-5.jpg",
  "/img/shops/shop-6.jpg",
  "/img/shops/shop-7.jpg",
  "/img/shops/shop-8.jpg",
  "/img/shops/shop-9.jpg",
  "/img/shops/shop-10.jpg",
];

// Map category name → image key
const CATEGORY_IMAGE_KEY: Record<string, string> = {
  "Bœuf": "boeuf",
  "Agneau": "agneau",
  "Volaille": "volaille",
  "Veau": "veau",
  "Grillades & BBQ": "grillades",
  "Préparations": "preparations",
  "Abats & Divers": "abats",
};

function getProductImg(categoryName: string, index: number): string {
  const key = CATEGORY_IMAGE_KEY[categoryName] || "boeuf";
  const images = PRODUCT_IMAGES[key];
  return images[index % images.length];
}

// ── Shop definitions ──────────────────────────

interface ShopDef {
  clerkId: string;
  ownerFirst: string;
  ownerLast: string;
  ownerEmail: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  description: string;
  prepTimeMin: number;
  status: "OPEN" | "BUSY" | "PAUSED" | "CLOSED" | "VACATION";
  busyMode?: boolean;
  busyExtraMin?: number;
  paused?: boolean;
  autoAccept?: boolean;
  maxOrdersPerHour?: number;
  rating: number;
  ratingCount: number;
  openingHours: Record<string, { open: string; close: string } | null>;
}

const SHOPS: ShopDef[] = [
  {
    clerkId: "boucher_elfathe", ownerFirst: "Karim", ownerLast: "Bensalem", ownerEmail: "k.bensalem@elfathe.fr",
    name: "El Fathe", slug: "el-fathe",
    address: "533 Faubourg Montmélian", city: "Chambéry", phone: "04 79 85 XX XX",
    description: "Boucherie halal certifiée. Spécialités bœuf Blonde d'Aquitaine, Charolais et Limousin. Viandes de qualité supérieure.",
    prepTimeMin: 15, status: "OPEN", autoAccept: false, maxOrdersPerHour: 25,
    rating: 4.8, ratingCount: 156,
    openingHours: { lundi: { open: "09:00", close: "19:00" }, mardi: { open: "09:00", close: "19:00" }, mercredi: { open: "09:00", close: "19:00" }, jeudi: { open: "09:00", close: "19:00" }, vendredi: { open: "09:00", close: "19:00" }, samedi: { open: "09:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_elba", ownerFirst: "Hassan", ownerLast: "Amrani", ownerEmail: "h.amrani@elbamarket.fr",
    name: "Elba Market Boucherie Halal", slug: "elba-market",
    address: "701 Avenue Général Cartier", city: "Chambéry (Bissy)", phone: "04 79 70 24 70",
    description: "Boucherie halal au cœur de Bissy. Large choix de viandes fraîches, volailles et préparations maison.",
    prepTimeMin: 20, status: "OPEN", maxOrdersPerHour: 20,
    rating: 4.6, ratingCount: 166,
    openingHours: { lundi: { open: "08:00", close: "19:30" }, mardi: { open: "08:00", close: "19:30" }, mercredi: { open: "08:00", close: "19:30" }, jeudi: { open: "08:00", close: "19:30" }, vendredi: { open: "08:00", close: "19:30" }, samedi: { open: "08:00", close: "19:30" }, dimanche: { open: "08:00", close: "12:30" } },
  },
  {
    clerkId: "boucher_elmektoub", ownerFirst: "Youssef", ownerLast: "Kadiri", ownerEmail: "y.kadiri@elmektoub.fr",
    name: "Boucherie El Mektoub", slug: "el-mektoub",
    address: "134 Rue Nicolas Parent", city: "Chambéry", phone: "06 60 10 00 55",
    description: "Boucherie halal en plein centre-ville. Viandes sélectionnées d'origine française.",
    prepTimeMin: 12, status: "OPEN", maxOrdersPerHour: 18,
    rating: 4.7, ratingCount: 89,
    openingHours: { lundi: { open: "08:30", close: "19:00" }, mardi: { open: "08:30", close: "19:00" }, mercredi: { open: "08:30", close: "19:00" }, jeudi: { open: "08:30", close: "19:00" }, vendredi: { open: "08:30", close: "19:00" }, samedi: { open: "08:30", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_hallesmed", ownerFirst: "Mehdi", ownerLast: "Boukhari", ownerEmail: "m.boukhari@hallesmed.fr",
    name: "Les Halles Méditerranéennes", slug: "halles-mediterraneennes",
    address: "279 Avenue des Landiers", city: "Chambéry", phone: "04 79 96 11 75",
    description: "Épicerie et boucherie halal. Produits du Maghreb, d'Asie et de Turquie. Merguez maison réputées.",
    prepTimeMin: 25, status: "OPEN", maxOrdersPerHour: 22,
    rating: 4.5, ratingCount: 203,
    openingHours: { lundi: { open: "08:00", close: "20:00" }, mardi: { open: "08:00", close: "20:00" }, mercredi: { open: "08:00", close: "20:00" }, jeudi: { open: "08:00", close: "20:00" }, vendredi: { open: "08:00", close: "20:00" }, samedi: { open: "08:00", close: "20:00" }, dimanche: { open: "09:00", close: "13:00" } },
  },
  {
    clerkId: "boucher_joppet", ownerFirst: "Rachid", ownerLast: "Hammoudi", ownerEmail: "r.hammoudi@joppet.fr",
    name: "Boucherie de Joppet", slug: "boucherie-joppet",
    address: "346 Rue Aristide Bergès", city: "Chambéry", phone: "06 10 96 46 87",
    description: "Le service du détail au prix du gros. Boucherie halal avec plats cuisinés, traiteur.",
    prepTimeMin: 18, status: "OPEN", maxOrdersPerHour: 15,
    rating: 4.4, ratingCount: 72,
    openingHours: { lundi: { open: "08:00", close: "19:00" }, mardi: { open: "08:00", close: "19:00" }, mercredi: { open: "08:00", close: "19:00" }, jeudi: { open: "08:00", close: "19:00" }, vendredi: { open: "08:00", close: "19:00" }, samedi: { open: "08:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_family", ownerFirst: "Omar", ownerLast: "Zeroual", ownerEmail: "o.zeroual@familymarket.fr",
    name: "Family Market", slug: "family-market",
    address: "290 Chemin du Verger", city: "Saint-Baldoph", phone: "04 79 XX XX XX",
    description: "Large sélection de viandes halal : Limousin, Aubrac, Blonde d'Aquitaine. Service traiteur.",
    prepTimeMin: 20, status: "OPEN", maxOrdersPerHour: 20,
    rating: 4.6, ratingCount: 134,
    openingHours: { lundi: { open: "08:30", close: "19:30" }, mardi: { open: "08:30", close: "19:30" }, mercredi: { open: "08:30", close: "19:30" }, jeudi: { open: "08:30", close: "19:30" }, vendredi: { open: "08:30", close: "19:30" }, samedi: { open: "08:30", close: "19:30" }, dimanche: null },
  },
  {
    clerkId: "boucher_elbacognin", ownerFirst: "Nabil", ownerLast: "Cherif", ownerEmail: "n.cherif@elbacognin.fr",
    name: "Elba Boucherie", slug: "elba-boucherie",
    address: "30 Route de Lyon", city: "Cognin", phone: "04 79 33 25 80",
    description: "Boucherie halal à Cognin. Viandes françaises de qualité. Spécialités grillades et BBQ.",
    prepTimeMin: 15, status: "OPEN", maxOrdersPerHour: 18,
    rating: 4.3, ratingCount: 58,
    openingHours: { lundi: { open: "09:00", close: "19:00" }, mardi: { open: "09:00", close: "19:00" }, mercredi: { open: "09:00", close: "19:00" }, jeudi: { open: "09:00", close: "19:00" }, vendredi: { open: "09:00", close: "19:00" }, samedi: { open: "09:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_sud", ownerFirst: "Samir", ownerLast: "Benali", ownerEmail: "s.benali@boucheriesud.fr",
    name: "Boucherie du Sud", slug: "boucherie-du-sud",
    address: "211 Avenue d'Annecy", city: "Chambéry", phone: "04 79 XX XX XX",
    description: "Boucherie halal spécialisée dans les viandes d'origine française. Service traiteur pour événements.",
    prepTimeMin: 22, status: "OPEN", maxOrdersPerHour: 16,
    rating: 4.5, ratingCount: 95,
    openingHours: { lundi: { open: "08:00", close: "19:00" }, mardi: { open: "08:00", close: "19:00" }, mercredi: { open: "08:00", close: "19:00" }, jeudi: { open: "08:00", close: "19:00" }, vendredi: { open: "08:00", close: "19:00" }, samedi: { open: "08:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_savoyardes", ownerFirst: "Tarik", ownerLast: "Mansouri", ownerEmail: "t.mansouri@hallessavoyardes.fr",
    name: "Les Halles Savoyardes", slug: "halles-savoyardes",
    address: "831 Avenue des Landiers", city: "Chambéry", phone: "04 79 XX XX XX",
    description: "Supermarché avec rayon boucherie halal. Fruits, légumes frais et épicerie orientale.",
    prepTimeMin: 30, status: "BUSY", busyMode: true, busyExtraMin: 10, maxOrdersPerHour: 30,
    rating: 4.2, ratingCount: 178,
    openingHours: { lundi: { open: "08:00", close: "20:00" }, mardi: { open: "08:00", close: "20:00" }, mercredi: { open: "08:00", close: "20:00" }, jeudi: { open: "08:00", close: "20:00" }, vendredi: { open: "08:00", close: "20:00" }, samedi: { open: "08:00", close: "20:00" }, dimanche: { open: "09:00", close: "13:00" } },
  },
  {
    clerkId: "boucher_arclusaz", ownerFirst: "Amir", ownerLast: "Touzani", ownerEmail: "a.touzani@arclusaz.fr",
    name: "Boucherie de l'Arclusaz", slug: "boucherie-arclusaz",
    address: "15 Rue Auguste Domenget", city: "Saint-Pierre-d'Albigny", phone: "04 79 XX XX XX",
    description: "L'excellence de la viande halal en Savoie. Charcuterie artisanale, viandes de qualité supérieure.",
    prepTimeMin: 15, status: "CLOSED", maxOrdersPerHour: 12,
    rating: 4.9, ratingCount: 47,
    openingHours: { lundi: null, mardi: { open: "08:00", close: "19:00" }, mercredi: { open: "08:00", close: "19:00" }, jeudi: { open: "08:00", close: "19:00" }, vendredi: { open: "08:00", close: "19:00" }, samedi: { open: "08:00", close: "13:00" }, dimanche: null },
  },
];

// ── Categories ──
const CATEGORIES = [
  { name: "Bœuf", emoji: "🥩", order: 1 },
  { name: "Agneau", emoji: "🐑", order: 2 },
  { name: "Volaille", emoji: "🐔", order: 3 },
  { name: "Veau", emoji: "🫕", order: 4 },
  { name: "Grillades & BBQ", emoji: "🔥", order: 5 },
  { name: "Préparations", emoji: "🧆", order: 6 },
  { name: "Abats & Divers", emoji: "🥘", order: 7 },
];

// ── Products ──
interface ProductDef {
  category: string;
  name: string;
  description: string;
  unit: "KG" | "PIECE" | "BARQUETTE";
  priceCents: number;
  proPriceCents: number;
  tags: string[];
  stockQty?: number;
  halalOrg?: string;
}

const PRODUCTS: ProductDef[] = [
  // 🥩 Bœuf
  { category: "Bœuf", name: "Steak de bœuf", description: "Steak tendre, idéal grillé ou poêlé. 150g/pers", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Bœuf", name: "Viande hachée de bœuf", description: "Hachée fraîche pur bœuf. 150g/pers", unit: "KG", priceCents: 1090, proPriceCents: 890, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Bœuf", name: "Steak haché (x4)", description: "4 steaks hachés de 125g", unit: "BARQUETTE", priceCents: 550, proPriceCents: 450, tags: ["Halal"], stockQty: 30, halalOrg: "AVS" },
  { category: "Bœuf", name: "Entrecôte de bœuf", description: "Entrecôte persillée et savoureuse. 200g/pers", unit: "KG", priceCents: 1990, proPriceCents: 1690, tags: ["Halal", "Premium"], halalOrg: "AVS" },
  { category: "Bœuf", name: "Faux-filet de bœuf", description: "Pièce noble, tendre et juteuse. 150g/pers", unit: "KG", priceCents: 2190, proPriceCents: 1850, tags: ["Halal", "Premium"], halalOrg: "ARGML" },
  { category: "Bœuf", name: "Côte de bœuf", description: "Pièce d'exception pour 3-4 personnes", unit: "KG", priceCents: 2290, proPriceCents: 1990, tags: ["Halal", "Premium"], halalOrg: "AVS" },
  { category: "Bœuf", name: "Bourguignon de bœuf", description: "Morceaux pour mijoté. 250g/pers", unit: "KG", priceCents: 1290, proPriceCents: 1050, tags: ["Halal"] },
  { category: "Bœuf", name: "Rumsteak", description: "Tendre et savoureux. 150g/pers", unit: "KG", priceCents: 1690, proPriceCents: 1450, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Bœuf", name: "Rôti de bœuf", description: "Ficelé, prêt à rôtir. 200g/pers", unit: "KG", priceCents: 1890, proPriceCents: 1590, tags: ["Halal"], halalOrg: "AVS" },
  // 🐑 Agneau
  { category: "Agneau", name: "Gigot d'agneau entier", description: "Avec os. 200g/pers", unit: "KG", priceCents: 1890, proPriceCents: 1650, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Agneau", name: "Épaule d'agneau", description: "Rôtie ou en tajine. 250g/pers", unit: "KG", priceCents: 1590, proPriceCents: 1390, tags: ["Halal"], halalOrg: "ARGML" },
  { category: "Agneau", name: "Côtelettes d'agneau", description: "2-3 côtelettes/pers", unit: "KG", priceCents: 1990, proPriceCents: 1750, tags: ["Halal"] },
  { category: "Agneau", name: "Souris d'agneau", description: "1 souris/pers (~300g)", unit: "KG", priceCents: 1790, proPriceCents: 1590, tags: ["Halal", "Premium"], halalOrg: "AVS" },
  { category: "Agneau", name: "Collier d'agneau", description: "Pour couscous, tajine, navarin", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal"] },
  // 🐔 Volaille
  { category: "Volaille", name: "Poulet entier", description: "1.5-1.8kg. Pour 4-5 personnes", unit: "KG", priceCents: 790, proPriceCents: 650, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Volaille", name: "Cuisses de poulet", description: "1 cuisse/pers (~250g)", unit: "KG", priceCents: 690, proPriceCents: 550, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Volaille", name: "Escalope de poulet", description: "Blanc tranché en escalopes fines. 150g/pers", unit: "KG", priceCents: 1290, proPriceCents: 1090, tags: ["Halal"] },
  { category: "Volaille", name: "Émincé de poulet", description: "En lanières. Sautés, wraps, wok", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal"] },
  { category: "Volaille", name: "Pilons de poulet", description: "3-4 pilons/pers. Grillés ou au four", unit: "KG", priceCents: 590, proPriceCents: 490, tags: ["Halal"] },
  { category: "Volaille", name: "Escalope de dinde", description: "Tranchée fine. 150g/pers", unit: "KG", priceCents: 1150, proPriceCents: 990, tags: ["Halal"], halalOrg: "AVS" },
  // 🫕 Veau
  { category: "Veau", name: "Escalope de veau", description: "Tranchée fine. 150g/pers", unit: "KG", priceCents: 2690, proPriceCents: 2350, tags: ["Halal", "Premium"], halalOrg: "AVS" },
  { category: "Veau", name: "Blanquette de veau", description: "Morceaux tendres pour mijoté", unit: "KG", priceCents: 1690, proPriceCents: 1450, tags: ["Halal"], halalOrg: "AVS" },
  { category: "Veau", name: "Côte de veau", description: "1 côte/pers (~250g)", unit: "KG", priceCents: 2290, proPriceCents: 1990, tags: ["Halal"], halalOrg: "ARGML" },
  // 🔥 Grillades
  { category: "Grillades & BBQ", name: "Merguez bœuf/agneau", description: "Artisanales. 3-4 merguez/pers", unit: "KG", priceCents: 1090, proPriceCents: 890, tags: ["Halal", "Maison"], halalOrg: "AVS" },
  { category: "Grillades & BBQ", name: "Brochettes de bœuf", description: "Marinées aux épices. 2 brochettes/pers", unit: "KG", priceCents: 1690, proPriceCents: 1450, tags: ["Halal"] },
  { category: "Grillades & BBQ", name: "Brochettes de poulet", description: "Marinées. 2 brochettes/pers", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal"] },
  { category: "Grillades & BBQ", name: "Kefta de bœuf", description: "Viande hachée épicée. 3-4 kefta/pers", unit: "KG", priceCents: 1290, proPriceCents: 1090, tags: ["Halal", "Maison"], halalOrg: "AVS" },
  // 🧆 Préparations
  { category: "Préparations", name: "Cordon bleu de poulet (x4)", description: "1-2 pièces/pers", unit: "BARQUETTE", priceCents: 690, proPriceCents: 550, tags: ["Halal"], stockQty: 20 },
  { category: "Préparations", name: "Boulettes de bœuf kefta", description: "4-5 boulettes/pers", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal", "Maison"] },
  // 🥘 Abats
  { category: "Abats & Divers", name: "Foie de bœuf", description: "Tranché. 150g/pers", unit: "KG", priceCents: 990, proPriceCents: 850, tags: ["Halal"] },
  { category: "Abats & Divers", name: "Tripes de bœuf", description: "Précuites. 200g/pers", unit: "KG", priceCents: 890, proPriceCents: 750, tags: ["Halal"] },
];

// Label color map
const LABEL_COLORS: Record<string, string> = {
  Halal: "#16a34a",
  Premium: "#ca8a04",
  Maison: "#e11d48",
  Fermier: "#059669",
  Bio: "#65a30d",
};

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log("🌱 Seeding Klik&Go V4 database...\n");

  // ── Clean ────────────────────────────────
  console.log("🗑  Cleaning existing data...");
  await prisma.referral.deleteMany();
  await prisma.suggestRule.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.planFeature.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.recurringOrder.deleteMany();
  await prisma.shopLog.deleteMany();
  await prisma.loyaltyPoint.deleteMany();
  await prisma.loyaltyRule.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productLabel.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.proAccess.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  // ═══════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════
  console.log("👤 Creating users...");

  const boucherUsers = [];
  for (const shop of SHOPS) {
    const user = await prisma.user.create({
      data: {
        clerkId: shop.clerkId,
        email: shop.ownerEmail,
        phone: "+336" + Math.floor(10000000 + Math.random() * 90000000),
        firstName: shop.ownerFirst,
        lastName: shop.ownerLast,
        role: Role.BOUCHER,
      },
    });
    boucherUsers.push(user);
  }

  const clients = await Promise.all([
    prisma.user.create({ data: { clerkId: "clerk_client_001", email: "marie.dupont@email.fr", phone: "+33611000001", firstName: "Marie", lastName: "Dupont", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_002", email: "pierre.martin@email.fr", phone: "+33611000002", firstName: "Pierre", lastName: "Martin", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_003", email: "sophie.m@email.fr", phone: "+33611000003", firstName: "Sophie", lastName: "Moreau", role: Role.CLIENT } }),
  ]);

  const pros = await Promise.all([
    prisma.user.create({ data: { clerkId: "clerk_pro_001", email: "bob@restaurant.fr", phone: "+33622000001", firstName: "Bob", lastName: "Dupuis", role: Role.CLIENT_PRO, proStatus: ProStatus.APPROVED, siret: "12345678900015", companyName: "Restaurant Le Savoyard", sector: "Restauration" } }),
    prisma.user.create({ data: { clerkId: "clerk_pro_002", email: "eric@cantine.fr", phone: "+33622000002", firstName: "Éric", lastName: "Cantine", role: Role.CLIENT_PRO_PENDING, proStatus: ProStatus.PENDING, siret: "78912345600056", companyName: "Cantine Scolaire Chambéry", sector: "Restauration collective" } }),
  ]);

  console.log(`   ✅ ${boucherUsers.length + clients.length + pros.length} users created`);

  // ═══════════════════════════════════════════
  // 2. SHOPS + CATEGORIES + PRODUCTS
  // ═══════════════════════════════════════════
  let totalProducts = 0;
  let totalCategories = 0;
  const shopRecords: { id: string; slug: string }[] = [];

  for (let si = 0; si < SHOPS.length; si++) {
    const def = SHOPS[si];
    console.log(`🏪 Creating ${def.name}...`);

    const shop = await prisma.shop.create({
      data: {
        ownerId: def.clerkId,
        name: def.name,
        slug: def.slug,
        description: def.description,
        address: def.address,
        city: def.city,
        phone: def.phone,
        imageUrl: SHOP_IMAGES[si % SHOP_IMAGES.length],
        openingHours: def.openingHours,
        prepTimeMin: def.prepTimeMin,
        status: def.status as any,
        busyMode: def.busyMode ?? false,
        busyExtraMin: def.busyExtraMin ?? 15,
        paused: def.paused ?? false,
        autoAccept: def.autoAccept ?? false,
        maxOrdersPerHour: def.maxOrdersPerHour ?? 20,
        rating: def.rating,
        ratingCount: def.ratingCount,
        visible: true,
      },
    });
    shopRecords.push({ id: shop.id, slug: shop.slug });

    const catMap = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const created = await prisma.category.create({
        data: { name: cat.name, emoji: cat.emoji, order: cat.order, shopId: shop.id },
      });
      catMap.set(cat.name, created.id);
      totalCategories++;
    }

    const promoIndices = new Set<number>();
    while (promoIndices.size < 5) {
      promoIndices.add(Math.floor(Math.random() * PRODUCTS.length));
    }

    // Track index per category for image variety
    const catImageIndex = new Map<string, number>();

    for (let pi = 0; pi < PRODUCTS.length; pi++) {
      const p = PRODUCTS[pi];
      const categoryId = catMap.get(p.category);
      if (!categoryId) continue;

      const imgIdx = catImageIndex.get(p.category) ?? 0;
      catImageIndex.set(p.category, imgIdx + 1);

      const isOutOfStock = Math.random() < 0.10;
      const hasPromo = promoIndices.has(pi);
      const promoEnd = hasPromo ? daysFromNow(7) : undefined;
      const promoPct = hasPromo ? [10, 15, 20][Math.floor(Math.random() * 3)] : undefined;

      const product = await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId,
          name: p.name,
          description: p.description,
          imageUrl: getProductImg(p.category, imgIdx),
          unit: Unit[p.unit],
          priceCents: varyPrice(p.priceCents),
          proPriceCents: varyPrice(p.proPriceCents),
          tags: p.tags,
          inStock: !isOutOfStock,
          stockQty: p.stockQty ?? null,
          promoPct: promoPct ?? null,
          promoEnd: promoEnd ?? null,
          promoType: hasPromo ? "PERCENTAGE" : null,
          halalOrg: p.halalOrg ?? null,
        },
      });

      // Create labels per product (one-to-many in V4)
      for (const tag of p.tags) {
        const color = LABEL_COLORS[tag];
        if (color) {
          await prisma.productLabel.create({
            data: { name: tag, color, productId: product.id },
          });
        }
      }

      totalProducts++;
    }
    console.log(`   ✅ ${def.name}: 7 categories, ${PRODUCTS.length} products`);
  }

  console.log(`\n📊 Total: ${shopRecords.length} shops, ${totalCategories} categories, ${totalProducts} products`);

  // ═══════════════════════════════════════════
  // 3. DEMO ORDERS
  // ═══════════════════════════════════════════
  console.log("\n📋 Creating demo orders...");

  const s1 = shopRecords[0];
  const s2 = shopRecords[1];
  const s1Prods = await prisma.product.findMany({ where: { shopId: s1.id }, take: 5 });
  const s2Prods = await prisma.product.findMany({ where: { shopId: s2.id }, take: 5 });

  const order1 = await prisma.order.create({ data: { orderNumber: "KG-2026-00001", shopId: s1.id, userId: clients[0].id, status: OrderStatus.READY, requestedTime: "asap", totalCents: s1Prods[0].priceCents + s1Prods[1].priceCents, estimatedReady: minutesAgo(5), actualReady: minutesAgo(5), qrCode: "KG-QR-00001" } });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Prods[0].id, name: s1Prods[0].name, quantity: 1, unit: s1Prods[0].unit, priceCents: s1Prods[0].priceCents, totalCents: s1Prods[0].priceCents } }),
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Prods[1].id, name: s1Prods[1].name, quantity: 1, unit: s1Prods[1].unit, priceCents: s1Prods[1].priceCents, totalCents: s1Prods[1].priceCents } }),
  ]);

  const order3 = await prisma.order.create({ data: { orderNumber: "KG-2026-00003", shopId: s2.id, userId: clients[1].id, status: OrderStatus.COMPLETED, totalCents: s2Prods[0].priceCents * 2, actualReady: minutesAgo(1470), pickedUpAt: minutesAgo(1440), qrCode: "KG-QR-00003", qrScannedAt: minutesAgo(1440), rating: 5, ratingComment: "Excellent comme toujours !" } });
  await prisma.orderItem.create({ data: { orderId: order3.id, productId: s2Prods[0].id, name: s2Prods[0].name, quantity: 2, unit: s2Prods[0].unit, priceCents: s2Prods[0].priceCents, totalCents: s2Prods[0].priceCents * 2 } });

  await prisma.order.create({ data: { orderNumber: "KG-2026-00004", shopId: s1.id, userId: clients[2].id, status: OrderStatus.PENDING, requestedTime: "asap", totalCents: s1Prods[3].priceCents } });
  await prisma.order.create({ data: { orderNumber: "KG-2026-00005", shopId: s2.id, userId: clients[0].id, status: OrderStatus.DENIED, totalCents: 2370, denyReason: "Rupture de stock généralisée" } });

  console.log("   ✅ 4 orders created");

  // ═══════════════════════════════════════════
  // 4. REVIEWS
  // ═══════════════════════════════════════════
  console.log("\n⭐ Creating reviews...");
  const reviewData = [
    { userId: clients[0].id, shopId: s1.id, rating: 5, comment: "Excellente qualité, viande toujours fraîche !" },
    { userId: clients[1].id, shopId: s1.id, rating: 4, comment: "Bon rapport qualité/prix, je recommande." },
    { userId: clients[2].id, shopId: s1.id, rating: 5, comment: "Le meilleur boucher du quartier." },
    { userId: clients[0].id, shopId: s2.id, rating: 4, comment: "Large choix, personnel agréable." },
    { userId: clients[1].id, shopId: s2.id, rating: 5, comment: "Toujours satisfait." },
  ];
  for (const r of reviewData) { await prisma.review.create({ data: r }); }
  console.log(`   ✅ ${reviewData.length} reviews`);

  // ═══════════════════════════════════════════
  // 5. LOYALTY RULES
  // ═══════════════════════════════════════════
  console.log("\n🎁 Creating loyalty rules...");
  for (const shop of shopRecords.slice(0, 5)) {
    await prisma.loyaltyRule.create({
      data: { shopId: shop.id, ordersRequired: 10, rewardPct: 10, description: "10 commandes = -10% !", active: true },
    });
  }
  console.log("   ✅ 5 loyalty rules");

  // ═══════════════════════════════════════════
  // 6. SUBSCRIPTIONS (2 TRIAL + 1 PENDING)
  // ═══════════════════════════════════════════
  console.log("\n💳 Creating subscriptions...");
  await prisma.subscription.create({
    data: { shopId: shopRecords[0].id, plan: "PRO", status: "TRIAL", trialEndsAt: daysFromNow(30) },
  });
  await prisma.subscription.create({
    data: { shopId: shopRecords[1].id, plan: "STARTER", status: "TRIAL", trialEndsAt: daysFromNow(30) },
  });
  await prisma.subscription.create({
    data: { shopId: shopRecords[2].id, plan: "PREMIUM", status: "PENDING", adminNote: "En attente de validation admin" },
  });
  console.log("   ✅ 3 subscriptions (2 TRIAL + 1 PENDING)");

  // ═══════════════════════════════════════════
  // 7. PLAN FEATURES
  // ═══════════════════════════════════════════
  console.log("\n📋 Creating plan features...");

  const features = [
    { key: "products_limit",    name: "Jusqu'à 30 produits",     starter: true,  pro: true,  premium: true },
    { key: "basic_orders",      name: "Gestion commandes",       starter: true,  pro: true,  premium: true },
    { key: "basic_stats",       name: "Statistiques basiques",   starter: true,  pro: true,  premium: true },
    { key: "single_image",      name: "1 photo par produit",     starter: true,  pro: true,  premium: true },
    { key: "pickup_slots",      name: "Créneaux retrait",        starter: true,  pro: true,  premium: true },
    { key: "pay_on_pickup",     name: "Paiement sur place",      starter: true,  pro: true,  premium: true },
    { key: "ai_chat",           name: "Chat IA commandes",       starter: false, pro: true,  premium: true },
    { key: "promo_flash",       name: "Promos flash",            starter: false, pro: true,  premium: true },
    { key: "multi_images",      name: "Photos multiples",        starter: false, pro: true,  premium: true },
    { key: "advanced_stats",    name: "Stats avancées",          starter: false, pro: true,  premium: true },
    { key: "whatsapp_notif",    name: "Notifications WhatsApp",  starter: false, pro: true,  premium: true },
    { key: "loyalty_program",   name: "Programme fidélité",      starter: false, pro: false, premium: true },
    { key: "priority_support",  name: "Support prioritaire",     starter: false, pro: false, premium: true },
    { key: "recurring_orders",  name: "Commandes récurrentes",   starter: false, pro: false, premium: true },
    { key: "custom_branding",   name: "Branding personnalisé",   starter: false, pro: false, premium: true },
  ];

  for (const f of features) {
    await prisma.planFeature.create({ data: { plan: "STARTER", featureKey: f.key, featureName: f.name, enabled: f.starter } });
    await prisma.planFeature.create({ data: { plan: "PRO", featureKey: f.key, featureName: f.name, enabled: f.pro } });
    await prisma.planFeature.create({ data: { plan: "PREMIUM", featureKey: f.key, featureName: f.name, enabled: f.premium } });
  }
  console.log(`   ✅ ${features.length * 3} plan features (3 plans x ${features.length})`);

  // ═══════════════════════════════════════════
  // 8. CALENDAR EVENTS
  // ═══════════════════════════════════════════
  console.log("\n📅 Creating calendar events...");
  await prisma.calendarEvent.create({ data: { name: "Ramadan début", description: "Début du mois sacré du Ramadan", date: new Date("2026-02-17"), type: "religious", alertDaysBefore: 14, active: true } });
  await prisma.calendarEvent.create({ data: { name: "Aïd el-Fitr", description: "Fête de la rupture du jeûne", date: new Date("2026-03-19"), type: "religious", alertDaysBefore: 7, active: true } });
  await prisma.calendarEvent.create({ data: { name: "Aïd el-Adha", description: "Fête du sacrifice", date: new Date("2026-05-26"), type: "religious", alertDaysBefore: 14, suggestedProducts: ["agneau entier", "pack méchoui"], active: true } });
  await prisma.calendarEvent.create({ data: { name: "Rentrée", description: "Rentrée scolaire — promos famille", date: new Date("2026-09-01"), type: "seasonal", alertDaysBefore: 7, active: true } });
  console.log("   ✅ 4 calendar events");

  // ═══════════════════════════════════════════
  // 9. SUGGEST RULES
  // ═══════════════════════════════════════════
  console.log("\n🤝 Creating suggest rules...");
  const merguez = await prisma.product.findFirst({ where: { shopId: s1.id, name: { contains: "Merguez" } } });
  const brochettes = await prisma.product.findFirst({ where: { shopId: s1.id, name: { contains: "Brochettes de bœuf" } } });
  const poulet = await prisma.product.findFirst({ where: { shopId: s1.id, name: { contains: "Poulet entier" } } });
  const kefta = await prisma.product.findFirst({ where: { shopId: s1.id, name: { contains: "Kefta" } } });

  if (merguez && brochettes) {
    await prisma.suggestRule.create({ data: { shopId: s1.id, sourceProductId: merguez.id, targetProductId: brochettes.id, weight: 5 } });
  }
  if (poulet && kefta) {
    await prisma.suggestRule.create({ data: { shopId: s1.id, sourceProductId: poulet.id, targetProductId: kefta.id, weight: 3 } });
  }
  console.log("   ✅ 2 suggest rules");

  // ═══════════════════════════════════════════
  // 10. REFERRAL
  // ═══════════════════════════════════════════
  console.log("\n🤝 Creating referral...");
  await prisma.referral.create({
    data: { referrerShopId: shopRecords[0].id, referredShopId: shopRecords[1].id, referrerRewardApplied: false, referredRewardApplied: false },
  });
  console.log("   ✅ 1 referral (El Fathe → Elba Market)");

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════");
  console.log("🌱 SEED V4 COMPLETE!");
  console.log("═══════════════════════════════════════════");
  console.log(`   👤 Users:         ${boucherUsers.length + clients.length + pros.length}`);
  console.log(`   🏪 Shops:         ${shopRecords.length}`);
  console.log(`   📂 Categories:    ${totalCategories}`);
  console.log(`   🥩 Products:      ${totalProducts}`);
  console.log(`   📋 Orders:        4`);
  console.log(`   ⭐ Reviews:       ${reviewData.length}`);
  console.log(`   🎁 Loyalty:       5 rules`);
  console.log(`   💳 Subscriptions: 3`);
  console.log(`   📋 Plan Features: ${features.length * 3}`);
  console.log(`   📅 Calendar:      4 events`);
  console.log(`   🤝 Suggest Rules: 2`);
  console.log(`   🤝 Referrals:     1`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error("❌ Seed error:", e); await prisma.$disconnect(); process.exit(1); });
