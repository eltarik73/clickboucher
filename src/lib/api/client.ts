// ═══════════════════════════════════════════════
// CLICKBOUCHER — Frontend API Client
// Typed fetch helpers for all API routes
// ═══════════════════════════════════════════════

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function apiFetch<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string; details?: Record<string, string[]> } }> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(url, options);
  return res.json();
}

// ── Shops ────────────────────────────────────

export const shopsApi = {
  list: (params?: { city?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/api/shops${qs ? `?${qs}` : ""}`);
  },
  get: (slug: string) => apiFetch(`/api/shops/${slug}`),
  products: (slug: string) => apiFetch(`/api/shops/${slug}/products`),
  packs: (slug: string) => apiFetch(`/api/shops/${slug}/packs`),
  offers: (slug: string) => apiFetch(`/api/shops/${slug}/offers`),
};

// ── Offers ───────────────────────────────────

export const offersApi = {
  list: (params?: { shopId?: string; page?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/api/offers${qs ? `?${qs}` : ""}`);
  },
};

// ── Orders ───────────────────────────────────

export const ordersApi = {
  list: (params: { userId?: string; shopId?: string; page?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/api/orders?${qs}`);
  },
  get: (id: string) => apiFetch(`/api/orders/${id}`),
  create: (data: {
    shopId: string;
    items: Array<{ productId?: string; packId?: string; quantity: number; weightGrams?: number }>;
    paymentMethod: string;
    userId?: string;
    guestPhone?: string;
  }) => apiFetch("/api/orders", "POST", data),
  updateStatus: (id: string, status: string, message?: string) =>
    apiFetch(`/api/orders/${id}/status`, "PATCH", { status, message }),
  submitWeights: (id: string, items: Array<{ orderItemId: string; actualWeightGrams: number }>) =>
    apiFetch(`/api/orders/${id}/weight`, "PATCH", { items }),
  stockAction: (id: string, data: { orderItemId: string; action: string; replacementProductId?: string }) =>
    apiFetch(`/api/orders/${id}/stock-action`, "POST", data),
};

// ── Auth ─────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) => apiFetch("/api/auth/otp/send", "POST", { phone }),
  verifyOtp: (phone: string, code: string) => apiFetch("/api/auth/otp/verify", "POST", { phone, code }),
};

// ── Favorites ────────────────────────────────

export const favoritesApi = {
  list: (userId: string) => apiFetch(`/api/favorites?userId=${userId}`),
  toggle: (userId: string, shopId: string) => apiFetch("/api/favorites/toggle", "POST", { userId, shopId }),
};

// ── Cart ─────────────────────────────────────

export const cartApi = {
  reserve: (offerId: string, quantity: number) => apiFetch("/api/cart/reserve", "POST", { offerId, quantity }),
};

// ── Payments ─────────────────────────────────

export const paymentsApi = {
  getStatus: (orderId: string) => apiFetch(`/api/payments/${orderId}`),
};

// ── Boucher ──────────────────────────────────

export const boucherApi = {
  updateService: (shopId: string, data: Record<string, unknown>) =>
    apiFetch(`/api/boucher/service?shopId=${shopId}`, "PATCH", data),
  updateProduct: (productId: string, data: Record<string, unknown>) =>
    apiFetch(`/api/boucher/catalogue/${productId}`, "PATCH", data),
};
