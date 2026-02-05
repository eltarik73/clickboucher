export type Shop = {
  id: string;
  name: string;
  city: string;
  rating?: number;
  reviewsCount?: number;
  distanceLabel?: string;
  nextSlotLabel?: string | null;
  isOpen?: boolean;
  closesAt?: string;
  opensAt?: string;
  tags?: string[];
  imageUrl?: string;
  halal?: boolean;
};

export type Product = {
  id: string;
  shopId: string;
  name: string;
  unit: string;
  publicPrice: number;
  proPrice: number;
  tags: string[];
  stock: boolean;
  prepTime: number;
};

export type Pack = {
  id: string;
  shopId: string;
  name: string;
  publicPrice: number;
  proPrice: number;
  tags: string[];
};

export type Offer = {
  id: string;
  title: string;
  shopName: string;
  percentOff: number;
  price: number;
  originalPrice: number;
  expiresInMinutes: number;
  qtyLeft: number;
  sponsored?: boolean;
  imageUrl?: string;
};

export type OrderStatus = "confirmed" | "preparing" | "ready" | "picked";

export type OrderItem = {
  name: string;
  qty: number;
  unit: string;
};

export type Order = {
  id: string;
  shopId: string;
  shopName: string;
  customerName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  pickupSlot: string;
};

export type CartItem = Product & { qty: number };

export type AppRole = "WEBMASTER" | "BUTCHER" | "CLIENT";
