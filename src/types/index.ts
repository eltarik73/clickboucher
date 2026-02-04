/* ═══════════════════════════════════════════════
   CLICKBOUCHER — Core Type Definitions
   ═══════════════════════════════════════════════ */

// ── Enums ────────────────────────────────────

export type UserRole = "CLIENT" | "PRO" | "BOUCHER" | "ADMIN";

export type ProStatus = "PENDING" | "APPROVED" | "REJECTED";

export type OrderStatus =
  | "PENDING"          // Commande passée, en attente acceptation
  | "ACCEPTED"         // Acceptée par le boucher
  | "PREPARING"        // En cours de préparation
  | "WEIGHING"         // Pesée en cours
  | "WEIGHT_REVIEW"    // Attente validation poids client
  | "STOCK_ISSUE"      // Rupture stock — action requise
  | "READY"            // Prête à retirer
  | "COLLECTED"        // Retirée
  | "CANCELLED";       // Annulée

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type PaymentMethod =
  | "CB_ONLINE"        // CB en ligne (mock)
  | "CB_SHOP"          // CB sur place
  | "CASH"             // Espèces sur place
  | "PRO_ACCOUNT";     // Compte client PRO (crédit)

export type ProductUnit = "KG" | "PIECE" | "BARQUETTE";

export type StockAction = "REPLACE" | "REMOVE" | "CONTACT";

// ── Shop ─────────────────────────────────────

export interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  imageUrl: string;
  coverUrl?: string;
  latitude: number;
  longitude: number;
  isServiceActive: boolean;
  isSurchargeMode: boolean;
  prepTimeMinutes: number;
  maxOrdersPer15Min: number;
  rating: number;
  reviewCount: number;
  openingHours: OpeningHours[];
  allowCashPayment: boolean;
  allowShopCardPayment: boolean;
}

export interface OpeningHours {
  dayOfWeek: number; // 0 = Sunday
  openTime: string;  // "09:00"
  closeTime: string; // "19:00"
  isClosed: boolean;
}

// ── Products ─────────────────────────────────

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: ProductUnit;
  pricePerUnit: number;      // cents
  proPricePerUnit?: number;  // cents (null = pas de prix PRO)
  isInStock: boolean;
  stockQuantity?: number;    // pour PIECE/BARQUETTE
  weightStep?: number;       // en grammes (ex: 100g = commande par tranches)
  minWeight?: number;        // poids minimum en grammes
}

export interface Pack {
  id: string;
  shopId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;             // cents
  proPrice?: number;
  items: PackItem[];
  isInStock: boolean;
  stockQuantity: number;
}

export interface PackItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: ProductUnit;
  weight?: number;           // grammes
}

// ── Offers (Dernière minute) ─────────────────

export interface Offer {
  id: string;
  shopId: string;
  shopName: string;
  productId?: string;
  name: string;
  description: string;
  imageUrl: string;
  originalPrice: number;     // cents
  discountPrice: number;     // cents
  quantity: number;
  remainingQuantity: number;
  expiresAt: string;         // ISO date
  isSponsored: boolean;
  reservedInCart: number;     // reserved qty (10 min hold)
}

// ── Cart ──────────────────────────────────────

export interface CartItem {
  id: string;
  productId?: string;
  packId?: string;
  name: string;
  imageUrl: string;
  unit: ProductUnit;
  quantity: number;
  weightGrams?: number;      // for KG items
  unitPrice: number;         // cents
  totalPrice: number;        // cents
  isLastMinute?: boolean;
}

export interface Cart {
  shopId: string;
  shopName: string;
  items: CartItem[];
  subtotal: number;
  lastMinuteReservationExpiry?: string;
}

// ── Orders ───────────────────────────────────

export interface Order {
  id: string;
  orderNumber: string;       // e.g. "CB-20240615-001"
  shopId: string;
  shopName: string;
  shopImageUrl: string;
  userId?: string;
  guestPhone?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotal: number;
  total: number;
  weightAdjustment?: number; // +/- cents after weighing
  estimatedReadyAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface OrderItem {
  id: string;
  productId?: string;
  packId?: string;
  name: string;
  imageUrl: string;
  unit: ProductUnit;
  quantity: number;
  requestedWeightGrams?: number;
  actualWeightGrams?: number;
  unitPrice: number;
  totalPrice: number;
  adjustedPrice?: number;
  weightDeviation?: number;  // percentage
  needsValidation: boolean;
  stockAction?: StockAction;
}

export interface TimelineEvent {
  status: OrderStatus;
  timestamp: string;
  message: string;
  detail?: string;
}

// ── User ─────────────────────────────────────

export interface User {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: UserRole;
  proStatus?: ProStatus;
  siret?: string;
  companyName?: string;
  favoriteShopIds: string[];
  proAccountEnabled?: boolean;
  proAccountLimit?: number;      // cents
  proAccountBalance?: number;    // cents
  proAccountDueDate?: string;
}

// ── Notifications (stub) ─────────────────────

export type NotificationChannel = "WHATSAPP" | "SMS" | "PUSH";

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  orderId?: string;
  sentAt?: string;
  readAt?: string;
}

// ── Payment (stub) ───────────────────────────

export interface PaymentIntent {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  clientSecret?: string;
  createdAt: string;
}

// ── API ──────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// ── Navigation ───────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  activeIcon: string;
}
