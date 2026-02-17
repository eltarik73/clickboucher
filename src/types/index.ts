// ═══════════════════════════════════════════════
// KLIK&GO — Types V4
// ═══════════════════════════════════════════════

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  order: number;
  isPrimary: boolean;
};

export type ProductLabel = {
  id: string;
  name: string;
  color: string | null;
};

export type CategoryInfo = {
  id: string;
  name: string;
  emoji: string | null;
  order: number;
};

export type Product = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  proPriceCents?: number | null;
  unit: "KG" | "PIECE" | "BARQUETTE";
  inStock: boolean;
  stockQty: number | null;
  minWeightG: number;
  weightStepG: number;
  maxWeightG: number;
  displayOrder: number;
  featured: boolean;
  popular: boolean;
  tags: string[];
  origin: string;
  halalOrg: string | null;
  race: string | null;
  freshness: string;
  customerNote: string | null;
  promoPct: number | null;
  promoEnd: string | null;
  promoType: string | null;
  category: CategoryInfo;
  images: ProductImage[];
  labels: ProductLabel[];
  createdAt: string;
  updatedAt: string;
};

export type Shop = {
  id: string;
  name: string;
  slug?: string;
  city: string;
  address?: string;
  phone?: string;
  imageUrl?: string | null;
  description?: string | null;
  rating: number;
  ratingCount: number;
  status: string;
  prepTimeMin?: number;
  tags?: string[];
  // Legacy fields (seed/data.ts)
  halal?: boolean;
  distanceLabel?: string;
  closesAt?: string;
  nextSlotLabel?: string;
};

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "COMPLETED"
  | "DENIED"
  | "CANCELLED"
  | "PARTIALLY_DENIED"
  | "AUTO_CANCELLED";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  priceCents: number;
  totalCents: number;
  available: boolean;
  replacement: string | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  shopId: string;
  status: OrderStatus;
  totalCents: number;
  items: OrderItem[];
  createdAt: string;
};

export type CartItem = Product & { qty: number };

export type AppRole = "WEBMASTER" | "BUTCHER" | "CLIENT";
