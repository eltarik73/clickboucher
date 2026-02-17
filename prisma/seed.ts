// ═══════════════════════════════════════════════
// KLIK&GO — Seed complet (bassin chambérien)
// 10 boucheries halal réalistes + catalogue complet
// ═══════════════════════════════════════════════

import { PrismaClient, Role, ProStatus, OrderStatus, Unit, RewardType } from "@prisma/client";

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

const IMG = "/images/boucherie-default.webp";

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
  isOpen: boolean;
  busyMode?: boolean;
  busyExtraMin?: number;
  paused?: boolean;
  autoAccept?: boolean;
  maxOrdersHour?: number;
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
    prepTimeMin: 15, isOpen: true, autoAccept: false, maxOrdersHour: 25,
    rating: 4.8, ratingCount: 156,
    openingHours: { lundi: { open: "09:00", close: "19:00" }, mardi: { open: "09:00", close: "19:00" }, mercredi: { open: "09:00", close: "19:00" }, jeudi: { open: "09:00", close: "19:00" }, vendredi: { open: "09:00", close: "19:00" }, samedi: { open: "09:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_elba", ownerFirst: "Hassan", ownerLast: "Amrani", ownerEmail: "h.amrani@elbamarket.fr",
    name: "Elba Market Boucherie Halal", slug: "elba-market",
    address: "701 Avenue Général Cartier", city: "Chambéry (Bissy)", phone: "04 79 70 24 70",
    description: "Boucherie halal au cœur de Bissy. Large choix de viandes fraîches, volailles et préparations maison. Brochettes et merguez artisanales.",
    prepTimeMin: 20, isOpen: true, maxOrdersHour: 20,
    rating: 4.6, ratingCount: 166,
    openingHours: { lundi: { open: "08:00", close: "19:30" }, mardi: { open: "08:00", close: "19:30" }, mercredi: { open: "08:00", close: "19:30" }, jeudi: { open: "08:00", close: "19:30" }, vendredi: { open: "08:00", close: "19:30" }, samedi: { open: "08:00", close: "19:30" }, dimanche: { open: "08:00", close: "12:30" } },
  },
  {
    clerkId: "boucher_elmektoub", ownerFirst: "Youssef", ownerLast: "Kadiri", ownerEmail: "y.kadiri@elmektoub.fr",
    name: "Boucherie El Mektoub", slug: "el-mektoub",
    address: "134 Rue Nicolas Parent", city: "Chambéry", phone: "06 60 10 00 55",
    description: "Boucherie halal en plein centre-ville. Viandes sélectionnées d'origine française. Spécialités orientales et grillades.",
    prepTimeMin: 12, isOpen: true, maxOrdersHour: 18,
    rating: 4.7, ratingCount: 89,
    openingHours: { lundi: { open: "08:30", close: "19:00" }, mardi: { open: "08:30", close: "19:00" }, mercredi: { open: "08:30", close: "19:00" }, jeudi: { open: "08:30", close: "19:00" }, vendredi: { open: "08:30", close: "19:00" }, samedi: { open: "08:30", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_hallesmed", ownerFirst: "Mehdi", ownerLast: "Boukhari", ownerEmail: "m.boukhari@hallesmed.fr",
    name: "Les Halles Méditerranéennes", slug: "halles-mediterraneennes",
    address: "279 Avenue des Landiers", city: "Chambéry", phone: "04 79 96 11 75",
    description: "Épicerie et boucherie halal. Produits du Maghreb, d'Asie et de Turquie. Beau rayon viandes à la coupe : bœuf, agneau, veau, volailles. Merguez maison réputées.",
    prepTimeMin: 25, isOpen: true, maxOrdersHour: 22,
    rating: 4.5, ratingCount: 203,
    openingHours: { lundi: { open: "08:00", close: "20:00" }, mardi: { open: "08:00", close: "20:00" }, mercredi: { open: "08:00", close: "20:00" }, jeudi: { open: "08:00", close: "20:00" }, vendredi: { open: "08:00", close: "20:00" }, samedi: { open: "08:00", close: "20:00" }, dimanche: { open: "09:00", close: "13:00" } },
  },
  {
    clerkId: "boucher_joppet", ownerFirst: "Rachid", ownerLast: "Hammoudi", ownerEmail: "r.hammoudi@joppet.fr",
    name: "Boucherie de Joppet", slug: "boucherie-joppet",
    address: "346 Rue Aristide Bergès", city: "Chambéry", phone: "06 10 96 46 87",
    description: "Le service du détail au prix du gros. Boucherie halal avec plats cuisinés, traiteur. Parking et livraison à domicile. Accès handicapé.",
    prepTimeMin: 18, isOpen: true, maxOrdersHour: 15,
    rating: 4.4, ratingCount: 72,
    openingHours: { lundi: { open: "08:00", close: "19:00" }, mardi: { open: "08:00", close: "19:00" }, mercredi: { open: "08:00", close: "19:00" }, jeudi: { open: "08:00", close: "19:00" }, vendredi: { open: "08:00", close: "19:00" }, samedi: { open: "08:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_family", ownerFirst: "Omar", ownerLast: "Zeroual", ownerEmail: "o.zeroual@familymarket.fr",
    name: "Family Market", slug: "family-market",
    address: "290 Chemin du Verger", city: "Saint-Baldoph", phone: "04 79 XX XX XX",
    description: "Large sélection de viandes halal : Limousin, Aubrac, Blonde d'Aquitaine. Veau élevé sous la mère. Service traiteur et rôtisserie. Parking.",
    prepTimeMin: 20, isOpen: true, maxOrdersHour: 20,
    rating: 4.6, ratingCount: 134,
    openingHours: { lundi: { open: "08:30", close: "19:30" }, mardi: { open: "08:30", close: "19:30" }, mercredi: { open: "08:30", close: "19:30" }, jeudi: { open: "08:30", close: "19:30" }, vendredi: { open: "08:30", close: "19:30" }, samedi: { open: "08:30", close: "19:30" }, dimanche: null },
  },
  {
    clerkId: "boucher_elbacognin", ownerFirst: "Nabil", ownerLast: "Cherif", ownerEmail: "n.cherif@elbacognin.fr",
    name: "Elba Boucherie", slug: "elba-boucherie",
    address: "30 Route de Lyon", city: "Cognin", phone: "04 79 33 25 80",
    description: "Boucherie halal à Cognin. Viandes françaises de qualité. Spécialités grillades et préparations BBQ.",
    prepTimeMin: 15, isOpen: true, maxOrdersHour: 18,
    rating: 4.3, ratingCount: 58,
    openingHours: { lundi: { open: "09:00", close: "19:00" }, mardi: { open: "09:00", close: "19:00" }, mercredi: { open: "09:00", close: "19:00" }, jeudi: { open: "09:00", close: "19:00" }, vendredi: { open: "09:00", close: "19:00" }, samedi: { open: "09:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_sud", ownerFirst: "Samir", ownerLast: "Benali", ownerEmail: "s.benali@boucheriesud.fr",
    name: "Boucherie du Sud", slug: "boucherie-du-sud",
    address: "211 Avenue d'Annecy", city: "Chambéry", phone: "04 79 XX XX XX",
    description: "Boucherie halal spécialisée dans les viandes d'origine française. Agneau, bœuf, volailles. Service traiteur pour événements.",
    prepTimeMin: 22, isOpen: true, maxOrdersHour: 16,
    rating: 4.5, ratingCount: 95,
    openingHours: { lundi: { open: "08:00", close: "19:00" }, mardi: { open: "08:00", close: "19:00" }, mercredi: { open: "08:00", close: "19:00" }, jeudi: { open: "08:00", close: "19:00" }, vendredi: { open: "08:00", close: "19:00" }, samedi: { open: "08:00", close: "19:00" }, dimanche: null },
  },
  {
    clerkId: "boucher_savoyardes", ownerFirst: "Tarik", ownerLast: "Mansouri", ownerEmail: "t.mansouri@hallessavoyardes.fr",
    name: "Les Halles Savoyardes", slug: "halles-savoyardes",
    address: "831 Avenue des Landiers", city: "Chambéry", phone: "04 79 XX XX XX",
    description: "Supermarché avec rayon boucherie halal. Fruits, légumes frais et épicerie orientale. Viandes à la coupe au quotidien.",
    prepTimeMin: 30, isOpen: true, busyMode: true, busyExtraMin: 10, maxOrdersHour: 30,
    rating: 4.2, ratingCount: 178,
    openingHours: { lundi: { open: "08:00", close: "20:00" }, mardi: { open: "08:00", close: "20:00" }, mercredi: { open: "08:00", close: "20:00" }, jeudi: { open: "08:00", close: "20:00" }, vendredi: { open: "08:00", close: "20:00" }, samedi: { open: "08:00", close: "20:00" }, dimanche: { open: "09:00", close: "13:00" } },
  },
  {
    clerkId: "boucher_arclusaz", ownerFirst: "Amir", ownerLast: "Touzani", ownerEmail: "a.touzani@arclusaz.fr",
    name: "Boucherie de l'Arclusaz", slug: "boucherie-arclusaz",
    address: "15 Rue Auguste Domenget", city: "Saint-Pierre-d'Albigny", phone: "04 79 XX XX XX",
    description: "L'excellence de la viande halal en Savoie. Charcuterie artisanale, viandes de qualité supérieure. Le goût de l'excellence.",
    prepTimeMin: 15, isOpen: false, maxOrdersHour: 12,
    rating: 4.9, ratingCount: 47,
    openingHours: { lundi: null, mardi: { open: "08:00", close: "19:00" }, mercredi: { open: "08:00", close: "19:00" }, jeudi: { open: "08:00", close: "19:00" }, vendredi: { open: "08:00", close: "19:00" }, samedi: { open: "08:00", close: "13:00" }, dimanche: null },
  },
];

// ── Category definitions ──────────────────────

const CATEGORIES = [
  { name: "Bœuf", emoji: "🥩", order: 1 },
  { name: "Agneau", emoji: "🐑", order: 2 },
  { name: "Volaille", emoji: "🐔", order: 3 },
  { name: "Veau", emoji: "🫕", order: 4 },
  { name: "Grillades & BBQ", emoji: "🔥", order: 5 },
  { name: "Préparations", emoji: "🧆", order: 6 },
  { name: "Abats & Divers", emoji: "🥘", order: 7 },
];

// ── Product catalog (base prices in cents) ────

interface ProductDef {
  category: string; // matches CATEGORIES.name
  name: string;
  description: string;
  unit: "KG" | "PIECE" | "BARQUETTE";
  priceCents: number;
  proPriceCents: number;
  tags: string[];
  stockQty?: number;
  origin?: string;
  halalOrg?: string;
}

const PRODUCTS: ProductDef[] = [
  // ── 🥩 Bœuf ──
  { category: "Bœuf", name: "Steak de bœuf", description: "Steak tendre, idéal grillé ou poêlé. Portion : 150g/pers", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal"], origin: "France — Charolais", halalOrg: "AVS" },
  { category: "Bœuf", name: "Viande hachée de bœuf", description: "Hachée fraîche pur bœuf. Idéale pour boulettes, kefta, bolognaise. 150g/pers", unit: "KG", priceCents: 1090, proPriceCents: 890, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Bœuf", name: "Steak haché (x4)", description: "4 steaks hachés de 125g. Prêts à cuire", unit: "BARQUETTE", priceCents: 550, proPriceCents: 450, tags: ["Halal"], stockQty: 30, origin: "France", halalOrg: "AVS" },
  { category: "Bœuf", name: "Entrecôte de bœuf", description: "Entrecôte persillée et savoureuse. 200g/pers", unit: "KG", priceCents: 1990, proPriceCents: 1690, tags: ["Halal", "Premium"], origin: "France — Blonde d'Aquitaine", halalOrg: "AVS" },
  { category: "Bœuf", name: "Faux-filet de bœuf", description: "Pièce noble, tendre et juteuse. 150g/pers", unit: "KG", priceCents: 2190, proPriceCents: 1850, tags: ["Halal", "Premium"], origin: "France — Limousin", halalOrg: "ARGML" },
  { category: "Bœuf", name: "Côte de bœuf", description: "Pièce d'exception pour 3-4 personnes (1.2kg). 300g/pers", unit: "KG", priceCents: 2290, proPriceCents: 1990, tags: ["Halal", "Premium"], origin: "France — Charolais", halalOrg: "AVS" },
  { category: "Bœuf", name: "Bourguignon de bœuf", description: "Morceaux pour mijoté. Paleron, macreuse. 250g/pers", unit: "KG", priceCents: 1290, proPriceCents: 1050, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Bœuf", name: "Pot-au-feu (plat de côtes)", description: "Avec os, idéal pour bouillon. 300g/pers avec os", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal"], origin: "France" },
  { category: "Bœuf", name: "Rumsteak", description: "Tendre et savoureux, grillé ou poêlé. 150g/pers", unit: "KG", priceCents: 1690, proPriceCents: 1450, tags: ["Halal"], origin: "France — Aubrac", halalOrg: "AVS" },
  { category: "Bœuf", name: "Rôti de bœuf", description: "Ficelé, prêt à rôtir. 200g/pers", unit: "KG", priceCents: 1890, proPriceCents: 1590, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Bœuf", name: "Bœuf à braiser (collier)", description: "Idéal tajine, couscous, daube. 250g/pers", unit: "KG", priceCents: 1150, proPriceCents: 950, tags: ["Halal"], origin: "France" },
  { category: "Bœuf", name: "Langue de bœuf", description: "Pièce entière. 200g/pers", unit: "KG", priceCents: 1490, proPriceCents: 1250, tags: ["Halal"], origin: "France" },

  // ── 🐑 Agneau ──
  { category: "Agneau", name: "Gigot d'agneau entier", description: "Avec os. 200g/pers. Idéal rôti au four", unit: "KG", priceCents: 1890, proPriceCents: 1650, tags: ["Halal"], origin: "France — Sisteron", halalOrg: "AVS" },
  { category: "Agneau", name: "Gigot d'agneau raccourci", description: "Plus charnu. 200g/pers", unit: "KG", priceCents: 2090, proPriceCents: 1850, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Agneau", name: "Épaule d'agneau", description: "Avec os. Rôtie ou en tajine. 250g/pers", unit: "KG", priceCents: 1590, proPriceCents: 1390, tags: ["Halal"], origin: "France", halalOrg: "ARGML" },
  { category: "Agneau", name: "Côtelettes d'agneau", description: "2-3 côtelettes/pers. Grillées ou poêlées", unit: "KG", priceCents: 1990, proPriceCents: 1750, tags: ["Halal"], origin: "Nouvelle-Zélande", halalOrg: "FIANZ" },
  { category: "Agneau", name: "Souris d'agneau", description: "1 souris/pers (~300g). Confite au four", unit: "KG", priceCents: 1790, proPriceCents: 1590, tags: ["Halal", "Premium"], origin: "France — Sisteron", halalOrg: "AVS" },
  { category: "Agneau", name: "Collier d'agneau", description: "Avec os. Pour couscous, tajine, navarin. 300g/pers", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal"], origin: "France" },
  { category: "Agneau", name: "Selle d'agneau", description: "Pièce noble. 200g/pers", unit: "KG", priceCents: 2290, proPriceCents: 1990, tags: ["Halal", "Premium"], origin: "France — Aveyron", halalOrg: "AVS" },
  { category: "Agneau", name: "Agneau coupé (ragoût)", description: "Morceaux pour tajine/couscous. 250g/pers", unit: "KG", priceCents: 1450, proPriceCents: 1250, tags: ["Halal"], origin: "France" },
  { category: "Agneau", name: "Foie d'agneau", description: "Tranché, poêlé. 150g/pers", unit: "KG", priceCents: 1290, proPriceCents: 1090, tags: ["Halal"], origin: "France" },
  { category: "Agneau", name: "Rognons d'agneau", description: "Par paire. 150g/pers", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal"], origin: "France" },

  // ── 🐔 Volaille ──
  { category: "Volaille", name: "Poulet entier", description: "1.5-1.8kg. Pour 4-5 personnes (300g/pers avec os)", unit: "KG", priceCents: 790, proPriceCents: 650, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Volaille", name: "Poulet fermier entier", description: "Label, élevé en plein air. 1.6-2kg", unit: "KG", priceCents: 1090, proPriceCents: 950, tags: ["Halal", "Fermier"], origin: "France — Loué", halalOrg: "AVS" },
  { category: "Volaille", name: "Cuisses de poulet", description: "1 cuisse/pers (~250g). Rôties ou en tajine", unit: "KG", priceCents: 690, proPriceCents: 550, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Volaille", name: "Escalope de poulet", description: "Blanc tranché en escalopes fines. 150g/pers", unit: "KG", priceCents: 1290, proPriceCents: 1090, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Blanc de poulet (filet)", description: "Filet entier à trancher. 150g/pers", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Émincé de poulet", description: "Coupé en lanières. Idéal sautés, wraps, wok. 150g/pers", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Pilons de poulet", description: "3-4 pilons/pers. Grillés ou au four", unit: "KG", priceCents: 590, proPriceCents: 490, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Ailes de poulet", description: "5-6 ailes/pers. BBQ ou marinées", unit: "KG", priceCents: 550, proPriceCents: 450, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Poulet coupé en morceaux", description: "Découpé en 8 ou 10 morceaux. Pour couscous, tajine", unit: "KG", priceCents: 890, proPriceCents: 750, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Cuisse de poulet désossée", description: "Sans os, prête à farcir ou griller. 200g/pers", unit: "KG", priceCents: 1090, proPriceCents: 950, tags: ["Halal"], origin: "France" },
  { category: "Volaille", name: "Escalope de dinde", description: "Tranchée fine. 150g/pers", unit: "KG", priceCents: 1150, proPriceCents: 990, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Volaille", name: "Cuisse de dinde", description: "1 cuisse pour 3-4 pers", unit: "KG", priceCents: 650, proPriceCents: 550, tags: ["Halal"], origin: "France" },

  // ── 🫕 Veau ──
  { category: "Veau", name: "Escalope de veau", description: "Tranchée fine. 150g/pers", unit: "KG", priceCents: 2690, proPriceCents: 2350, tags: ["Halal", "Premium"], origin: "France — élevé sous la mère", halalOrg: "AVS" },
  { category: "Veau", name: "Blanquette de veau", description: "Morceaux tendres pour mijoté. 250g/pers", unit: "KG", priceCents: 1690, proPriceCents: 1450, tags: ["Halal"], origin: "France", halalOrg: "AVS" },
  { category: "Veau", name: "Côte de veau", description: "1 côte/pers (~250g)", unit: "KG", priceCents: 2290, proPriceCents: 1990, tags: ["Halal"], origin: "France", halalOrg: "ARGML" },
  { category: "Veau", name: "Rôti de veau", description: "Ficelé, au four. 200g/pers", unit: "KG", priceCents: 2490, proPriceCents: 2190, tags: ["Halal"], origin: "France" },
  { category: "Veau", name: "Osso buco", description: "Jarret tranché avec os. 250g/pers", unit: "KG", priceCents: 1590, proPriceCents: 1390, tags: ["Halal"], origin: "France" },
  { category: "Veau", name: "Foie de veau", description: "Tranché, poêlé. 150g/pers", unit: "KG", priceCents: 1890, proPriceCents: 1650, tags: ["Halal"], origin: "France" },

  // ── 🔥 Grillades & BBQ ──
  { category: "Grillades & BBQ", name: "Merguez bœuf/agneau", description: "Artisanales. 3-4 merguez/pers (~150g)", unit: "KG", priceCents: 1090, proPriceCents: 890, tags: ["Halal", "Maison"], origin: "Fabrication maison", halalOrg: "AVS" },
  { category: "Grillades & BBQ", name: "Brochettes de bœuf", description: "Marinées aux épices. 2 brochettes/pers", unit: "KG", priceCents: 1690, proPriceCents: 1450, tags: ["Halal"], origin: "France" },
  { category: "Grillades & BBQ", name: "Brochettes de poulet", description: "Marinées. 2 brochettes/pers", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal"], origin: "France" },
  { category: "Grillades & BBQ", name: "Brochettes d'agneau", description: "Marinées. 2 brochettes/pers", unit: "KG", priceCents: 1790, proPriceCents: 1550, tags: ["Halal"], origin: "France" },
  { category: "Grillades & BBQ", name: "Brochettes mixtes (bœuf/poulet)", description: "Assortiment. 2-3 brochettes/pers", unit: "KG", priceCents: 1590, proPriceCents: 1350, tags: ["Halal"], origin: "France" },
  { category: "Grillades & BBQ", name: "Saucisse de volaille", description: "2 saucisses/pers (~150g)", unit: "KG", priceCents: 990, proPriceCents: 850, tags: ["Halal"], origin: "Fabrication maison" },
  { category: "Grillades & BBQ", name: "Chipolatas de bœuf", description: "2 chipolatas/pers", unit: "KG", priceCents: 1050, proPriceCents: 890, tags: ["Halal"], origin: "Fabrication maison" },
  { category: "Grillades & BBQ", name: "Kefta de bœuf", description: "Viande hachée épicée. 3-4 kefta/pers", unit: "KG", priceCents: 1290, proPriceCents: 1090, tags: ["Halal", "Maison"], origin: "Fabrication maison", halalOrg: "AVS" },
  { category: "Grillades & BBQ", name: "Côtelettes d'agneau marinées", description: "Provençale ou orientale", unit: "KG", priceCents: 2190, proPriceCents: 1890, tags: ["Halal", "Mariné"], origin: "France" },

  // ── 🧆 Préparations ──
  { category: "Préparations", name: "Cordon bleu de poulet (x4)", description: "1-2 pièces/pers", unit: "BARQUETTE", priceCents: 690, proPriceCents: 550, tags: ["Halal"], stockQty: 20, origin: "Fabrication maison" },
  { category: "Préparations", name: "Paupiette de veau (x2)", description: "1 paupiette/pers", unit: "BARQUETTE", priceCents: 890, proPriceCents: 750, tags: ["Halal"], stockQty: 15, origin: "Fabrication maison" },
  { category: "Préparations", name: "Boulettes de bœuf kefta", description: "Épicées. 4-5 boulettes/pers", unit: "KG", priceCents: 1190, proPriceCents: 990, tags: ["Halal", "Maison"], origin: "Fabrication maison" },
  { category: "Préparations", name: "Viande hachée d'agneau", description: "Pour kefta, boulettes. 150g/pers", unit: "KG", priceCents: 1490, proPriceCents: 1250, tags: ["Halal"], origin: "France" },
  { category: "Préparations", name: "Poulet mariné à l'orientale", description: "Cuisses marinées curcuma-citron", unit: "KG", priceCents: 1090, proPriceCents: 950, tags: ["Halal", "Mariné"], origin: "France" },
  { category: "Préparations", name: "Kebab maison (émincé)", description: "Émincé de bœuf épicé", unit: "KG", priceCents: 1390, proPriceCents: 1190, tags: ["Halal", "Maison"], origin: "Fabrication maison" },

  // ── 🥘 Abats & Divers ──
  { category: "Abats & Divers", name: "Foie de bœuf", description: "Tranché. 150g/pers", unit: "KG", priceCents: 990, proPriceCents: 850, tags: ["Halal"], origin: "France" },
  { category: "Abats & Divers", name: "Tripes de bœuf", description: "Précuites. 200g/pers", unit: "KG", priceCents: 890, proPriceCents: 750, tags: ["Halal"], origin: "France" },
  { category: "Abats & Divers", name: "Cervelle d'agneau", description: "150g/pers", unit: "KG", priceCents: 1490, proPriceCents: 1250, tags: ["Halal"], origin: "France" },
  { category: "Abats & Divers", name: "Cœur de bœuf", description: "Tranché, grillé ou mijoté. 200g/pers", unit: "KG", priceCents: 850, proPriceCents: 700, tags: ["Halal"], origin: "France" },
  { category: "Abats & Divers", name: "Pattes de poulet", description: "Pour bouillon", unit: "KG", priceCents: 390, proPriceCents: 300, tags: ["Halal"], origin: "France" },
];

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log("🌱 Seeding Klik&Go database...\n");

  // ── Clean ────────────────────────────────
  console.log("🗑  Cleaning existing data...");
  await prisma.loyaltyPoints.deleteMany();
  await prisma.loyaltyRule.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.productLabel.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  // ═══════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════

  console.log("👤 Creating users...");

  // Create boucher users for each shop
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

  // Test clients
  const clients = await Promise.all([
    prisma.user.create({ data: { clerkId: "clerk_client_001", email: "marie.dupont@email.fr", phone: "+33611000001", firstName: "Marie", lastName: "Dupont", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_002", email: "pierre.martin@email.fr", phone: "+33611000002", firstName: "Pierre", lastName: "Martin", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_003", email: "sophie.m@email.fr", phone: "+33611000003", firstName: "Sophie", lastName: "Moreau", role: Role.CLIENT } }),
  ]);

  // Test pro clients
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
        imageUrl: IMG,
        openingHours: def.openingHours,
        prepTimeMin: def.prepTimeMin,
        isOpen: def.isOpen,
        busyMode: def.busyMode ?? false,
        busyExtraMin: def.busyExtraMin ?? 10,
        paused: def.paused ?? false,
        autoAccept: def.autoAccept ?? false,
        maxOrdersHour: def.maxOrdersHour ?? 20,
        rating: def.rating,
        ratingCount: def.ratingCount,
      },
    });
    shopRecords.push({ id: shop.id, slug: shop.slug });

    // Create categories
    const catMap = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const created = await prisma.category.create({
        data: { name: cat.name, emoji: cat.emoji, order: cat.order, shopId: shop.id },
      });
      catMap.set(cat.name, created.id);
      totalCategories++;
    }

    // Pick ~5 random products for promos
    const promoIndices = new Set<number>();
    while (promoIndices.size < 5) {
      promoIndices.add(Math.floor(Math.random() * PRODUCTS.length));
    }

    // Create products with price variation
    for (let pi = 0; pi < PRODUCTS.length; pi++) {
      const p = PRODUCTS[pi];
      const categoryId = catMap.get(p.category);
      if (!categoryId) continue;

      const isOutOfStock = Math.random() < 0.10; // ~10% out of stock
      const hasPromo = promoIndices.has(pi);
      const promoEnd = hasPromo ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined;
      const promoPct = hasPromo ? [10, 15, 20][Math.floor(Math.random() * 3)] : undefined;

      await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId,
          name: p.name,
          description: p.description,
          imageUrl: IMG,
          unit: Unit[p.unit],
          priceCents: varyPrice(p.priceCents),
          proPriceCents: varyPrice(p.proPriceCents),
          tags: p.tags,
          inStock: !isOutOfStock,
          stockQty: p.stockQty ?? null,
          promoPct: promoPct ?? null,
          promoEnd: promoEnd ?? null,
          origin: p.origin ?? null,
          halalOrg: p.halalOrg ?? null,
        },
      });
      totalProducts++;
    }

    console.log(`   ✅ ${def.name}: 7 categories, ${PRODUCTS.length} products`);
  }

  console.log(`\n📊 Total: ${shopRecords.length} shops, ${totalCategories} categories, ${totalProducts} products`);

  // ═══════════════════════════════════════════
  // 3. DEMO ORDERS
  // ═══════════════════════════════════════════

  console.log("\n📋 Creating demo orders...");

  const s1 = shopRecords[0]; // El Fathe
  const s2 = shopRecords[1]; // Elba Market

  // Get some products for orders
  const s1Prods = await prisma.product.findMany({ where: { shopId: s1.id }, take: 5 });
  const s2Prods = await prisma.product.findMany({ where: { shopId: s2.id }, take: 5 });

  // Order 1: READY (Marie @ El Fathe)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00001",
      shopId: s1.id,
      userId: clients[0].id,
      status: OrderStatus.READY,
      requestedTime: "asap",
      totalCents: s1Prods[0].priceCents + s1Prods[1].priceCents,
      estimatedReady: minutesAgo(5),
      actualReady: minutesAgo(5),
      qrCode: "KG-QR-00001",
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Prods[0].id, name: s1Prods[0].name, quantity: 1, unit: s1Prods[0].unit, priceCents: s1Prods[0].priceCents, totalCents: s1Prods[0].priceCents } }),
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Prods[1].id, name: s1Prods[1].name, quantity: 1, unit: s1Prods[1].unit, priceCents: s1Prods[1].priceCents, totalCents: s1Prods[1].priceCents } }),
  ]);

  // Order 2: PREPARING (Bob PRO @ El Fathe)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00002",
      shopId: s1.id,
      userId: pros[0].id,
      isPro: true,
      status: OrderStatus.PREPARING,
      requestedTime: "asap",
      totalCents: (s1Prods[2].proPriceCents ?? s1Prods[2].priceCents) * 3,
      estimatedReady: minutesFromNow(15),
    },
  });
  await prisma.orderItem.create({
    data: { orderId: order2.id, productId: s1Prods[2].id, name: s1Prods[2].name, quantity: 3, unit: s1Prods[2].unit, priceCents: s1Prods[2].proPriceCents ?? s1Prods[2].priceCents, totalCents: (s1Prods[2].proPriceCents ?? s1Prods[2].priceCents) * 3 },
  });

  // Order 3: COMPLETED avec rating (Pierre @ Elba)
  const order3 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00003",
      shopId: s2.id,
      userId: clients[1].id,
      status: OrderStatus.COMPLETED,
      totalCents: s2Prods[0].priceCents * 2,
      actualReady: minutesAgo(1470),
      pickedUpAt: minutesAgo(1440),
      qrCode: "KG-QR-00003",
      qrScannedAt: minutesAgo(1440),
      rating: 5,
      ratingComment: "Excellent comme toujours !",
    },
  });
  await prisma.orderItem.create({
    data: { orderId: order3.id, productId: s2Prods[0].id, name: s2Prods[0].name, quantity: 2, unit: s2Prods[0].unit, priceCents: s2Prods[0].priceCents, totalCents: s2Prods[0].priceCents * 2 },
  });

  // Order 4: PENDING (Sophie @ El Fathe)
  const order4 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00004",
      shopId: s1.id,
      userId: clients[2].id,
      status: OrderStatus.PENDING,
      requestedTime: "asap",
      totalCents: s1Prods[3].priceCents,
    },
  });
  await prisma.orderItem.create({
    data: { orderId: order4.id, productId: s1Prods[3].id, name: s1Prods[3].name, quantity: 1, unit: s1Prods[3].unit, priceCents: s1Prods[3].priceCents, totalCents: s1Prods[3].priceCents },
  });

  // Order 5: DENIED (Marie @ Elba)
  await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00005",
      shopId: s2.id,
      userId: clients[0].id,
      status: OrderStatus.DENIED,
      totalCents: 2370,
      denyReason: "Rupture de stock généralisée, commande impossible",
    },
  });

  // Order 6: CANCELLED (Pierre)
  await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00006",
      shopId: s2.id,
      userId: clients[1].id,
      status: OrderStatus.CANCELLED,
      totalCents: 1580,
      customerNote: "Finalement je ne peux pas venir",
    },
  });

  // Order 7: PARTIALLY_DENIED (Sophie @ Elba)
  const order7 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00007",
      shopId: s2.id,
      userId: clients[2].id,
      status: OrderStatus.PARTIALLY_DENIED,
      totalCents: s2Prods[1].priceCents + s2Prods[2].priceCents,
      boucherNote: "Un article indisponible",
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order7.id, productId: s2Prods[1].id, name: s2Prods[1].name, quantity: 1, unit: s2Prods[1].unit, priceCents: s2Prods[1].priceCents, totalCents: s2Prods[1].priceCents } }),
    prisma.orderItem.create({ data: { orderId: order7.id, productId: s2Prods[2].id, name: s2Prods[2].name, quantity: 1, unit: s2Prods[2].unit, priceCents: s2Prods[2].priceCents, totalCents: s2Prods[2].priceCents, available: false, replacement: "Produit alternatif" } }),
  ]);

  console.log("   ✅ 7 orders created");

  // ═══════════════════════════════════════════
  // 4. PRODUCT LABELS
  // ═══════════════════════════════════════════

  console.log("\n🏷  Creating product labels...");

  const labelDefs = [
    { name: "Halal",          color: "#16a34a", icon: "☪️" },
    { name: "Bio",            color: "#65a30d", icon: "🌿" },
    { name: "Local",          color: "#2563eb", icon: "📍" },
    { name: "Promo",          color: "#dc2626", icon: "🔥" },
    { name: "Nouveau",        color: "#7c3aed", icon: "✨" },
    { name: "Race à Viande",  color: "#b45309", icon: "🐂" },
    { name: "Fermier",        color: "#059669", icon: "🌾" },
    { name: "Premium",        color: "#ca8a04", icon: "⭐" },
    { name: "Maison",         color: "#e11d48", icon: "👨‍🍳" },
  ];

  const labels = new Map<string, string>();
  for (const l of labelDefs) {
    const label = await prisma.productLabel.create({ data: l });
    labels.set(l.name, label.id);
  }
  console.log(`   ✅ ${labelDefs.length} labels created`);

  // Connect labels to products based on tags
  const allProducts = await prisma.product.findMany({ select: { id: true, tags: true } });
  let labelConnections = 0;
  for (const prod of allProducts) {
    const labelIds: string[] = [];
    for (const tag of prod.tags) {
      const lid = labels.get(tag);
      if (lid) labelIds.push(lid);
    }
    if (labelIds.length > 0) {
      await prisma.product.update({
        where: { id: prod.id },
        data: { labels: { connect: labelIds.map((id) => ({ id })) } },
      });
      labelConnections += labelIds.length;
    }
  }
  console.log(`   ✅ ${labelConnections} label-product connections`);

  // ═══════════════════════════════════════════
  // 5. REVIEWS
  // ═══════════════════════════════════════════

  console.log("\n⭐ Creating reviews...");

  const reviewData = [
    { userId: clients[0].id, shopId: s1.id, rating: 5, comment: "Excellente qualité, viande toujours fraîche !" },
    { userId: clients[1].id, shopId: s1.id, rating: 4, comment: "Bon rapport qualité/prix, je recommande." },
    { userId: clients[2].id, shopId: s1.id, rating: 5, comment: "Le meilleur boucher du quartier, merguez exceptionnelles." },
    { userId: clients[0].id, shopId: s2.id, rating: 4, comment: "Large choix, personnel agréable." },
    { userId: clients[1].id, shopId: s2.id, rating: 5, comment: "Toujours satisfait, commande rapide." },
    { userId: clients[2].id, shopId: s2.id, rating: 3, comment: "Correct mais un peu cher." },
    { userId: pros[0].id,    shopId: s1.id, rating: 5, comment: "Fournisseur fiable pour mon restaurant. Prix pro intéressants." },
    { userId: clients[0].id, shopId: shopRecords[2].id, rating: 4, comment: "Bonne boucherie en centre-ville." },
    { userId: clients[1].id, shopId: shopRecords[3].id, rating: 5, comment: "Les merguez maison sont incroyables !" },
    { userId: clients[2].id, shopId: shopRecords[4].id, rating: 4, comment: "Livraison rapide, viande de qualité." },
  ];

  for (const r of reviewData) {
    await prisma.review.create({ data: r });
  }
  console.log(`   ✅ ${reviewData.length} reviews created`);

  // ═══════════════════════════════════════════
  // 6. LOYALTY RULES
  // ═══════════════════════════════════════════

  console.log("\n🎁 Creating loyalty rules...");

  let loyaltyCount = 0;
  for (const shop of shopRecords.slice(0, 5)) {
    await prisma.loyaltyRule.create({
      data: {
        shopId: shop.id,
        name: "1 point par euro dépensé",
        description: "Cumulez des points à chaque commande. 100 points = 5€ de réduction !",
        pointsPerEuro: 1,
        rewardThreshold: 100,
        rewardType: RewardType.DISCOUNT,
        rewardValue: 500,
        active: true,
      },
    });
    loyaltyCount++;
  }
  console.log(`   ✅ ${loyaltyCount} loyalty rules created`);

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════

  console.log("\n═══════════════════════════════════════════");
  console.log("🌱 SEED COMPLETE! (Schema V2)");
  console.log("═══════════════════════════════════════════");
  console.log(`   👤 Users:      ${boucherUsers.length + clients.length + pros.length}`);
  console.log(`   🏪 Shops:      ${shopRecords.length}`);
  console.log(`   📂 Categories: ${totalCategories}`);
  console.log(`   🥩 Products:   ${totalProducts}`);
  console.log(`   📋 Orders:     7`);
  console.log(`   🏷  Labels:     ${labelDefs.length}`);
  console.log(`   ⭐ Reviews:    ${reviewData.length}`);
  console.log(`   🎁 Loyalty:    ${loyaltyCount} rules`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
