// Legacy seed data — uses old types, kept for backward compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SHOPS: any[] = [
  {
    id: "cb_savoie_halal_1",
    name: "Boucherie Halal Saint-Leger",
    city: "Chambery",
    halal: true,
    isOpen: true,
    closesAt: "19:30",
    nextSlotLabel: "20 min",
    distanceLabel: "350m",
    rating: 4.8,
    ratingCount: 127,
    tags: ["Brochettes", "BBQ"],
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "cb_savoie_halal_2",
    name: "Maison Halal des Halles",
    city: "Chambery",
    halal: true,
    isOpen: true,
    closesAt: "20:00",
    nextSlotLabel: "30 min",
    distanceLabel: "1.2km",
    rating: 4.6,
    ratingCount: 89,
    tags: ["Charcuterie", "Traiteur"],
    imageUrl: "https://images.unsplash.com/photo-1604909052743-94e838986d24?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "cb_savoie_halal_3",
    name: "L'Etal Halal du Marche",
    city: "Chambery",
    halal: true,
    isOpen: false,
    opensAt: "14:30",
    nextSlotLabel: null,
    distanceLabel: "2.1km",
    rating: 4.4,
    ratingCount: 56,
    tags: ["Agneau", "Veau"],
    imageUrl: "https://images.unsplash.com/photo-1541544181093-7e2a5a5c1c31?w=600&q=80&auto=format&fit=crop",
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PRODUCTS: any[] = [
  { id: "p1", shopId: "cb_savoie_halal_1", name: "Viande hachee 5% (boeuf)", unit: "kg", publicPrice: 13.90, proPrice: 11.90, tags: ["Halal"], stock: true, prepTime: 5 },
  { id: "p2", shopId: "cb_savoie_halal_1", name: "Merguez (lot)", unit: "kg", publicPrice: 12.90, proPrice: 10.90, tags: ["Halal", "BBQ"], stock: true, prepTime: 5 },
  { id: "p3", shopId: "cb_savoie_halal_1", name: "Brochettes de poulet", unit: "kg", publicPrice: 16.90, proPrice: 14.90, tags: ["Halal", "BBQ"], stock: true, prepTime: 10 },
  { id: "p4", shopId: "cb_savoie_halal_1", name: "Filet de poulet (entier)", unit: "kg", publicPrice: 12.90, proPrice: 10.90, tags: ["Halal"], stock: true, prepTime: 5 },
  { id: "p5", shopId: "cb_savoie_halal_1", name: "Cotes d'agneau", unit: "kg", publicPrice: 24.90, proPrice: 22.90, tags: ["Halal"], stock: false, prepTime: 10 },
  { id: "p6", shopId: "cb_savoie_halal_1", name: "Escalope de veau", unit: "kg", publicPrice: 26.90, proPrice: 23.90, tags: ["Halal"], stock: true, prepTime: 10 },
  { id: "p7", shopId: "cb_savoie_halal_2", name: "Saucisse fines herbes", unit: "kg", publicPrice: 12.90, proPrice: 10.90, tags: ["Halal"], stock: true, prepTime: 5 },
  { id: "p8", shopId: "cb_savoie_halal_2", name: "Saucisse fromage", unit: "kg", publicPrice: 13.90, proPrice: 11.90, tags: ["Halal"], stock: true, prepTime: 5 },
  { id: "p9", shopId: "cb_savoie_halal_2", name: "Gigot d'agneau", unit: "kg", publicPrice: 19.90, proPrice: 17.90, tags: ["Halal"], stock: true, prepTime: 15 },
  { id: "p10", shopId: "cb_savoie_halal_2", name: "Blanquette de veau", unit: "kg", publicPrice: 19.90, proPrice: 17.90, tags: ["Halal"], stock: true, prepTime: 10 },
  { id: "p11", shopId: "cb_savoie_halal_3", name: "Steak (boeuf)", unit: "kg", publicPrice: 22.90, proPrice: 19.90, tags: ["Halal"], stock: true, prepTime: 5 },
  { id: "p12", shopId: "cb_savoie_halal_3", name: "Bourguignon (boeuf)", unit: "kg", publicPrice: 16.90, proPrice: 14.90, tags: ["Halal"], stock: true, prepTime: 15 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SEED_ORDERS: any[] = [
  { id: "CMD-001", shopId: "cb_savoie_halal_1", shopName: "Boucherie Halal Saint-Leger", customerName: "Karim B.", items: [{ name: "Merguez (lot)", qty: 2, unit: "kg" }, { name: "Brochettes de poulet", qty: 1.5, unit: "kg" }], total: 51.15, status: "confirmed", createdAt: "14:23", pickupSlot: "15:00" },
  { id: "CMD-002", shopId: "cb_savoie_halal_1", shopName: "Boucherie Halal Saint-Leger", customerName: "Sophie M.", items: [{ name: "Filet de poulet (entier)", qty: 1, unit: "kg" }], total: 12.90, status: "preparing", createdAt: "14:45", pickupSlot: "15:30" },
  { id: "CMD-003", shopId: "cb_savoie_halal_2", shopName: "Maison Halal des Halles", customerName: "Ahmed L.", items: [{ name: "Gigot d'agneau", qty: 2, unit: "kg" }, { name: "Saucisse fromage", qty: 1, unit: "kg" }], total: 53.70, status: "ready", createdAt: "13:10", pickupSlot: "14:00" },
];
