// src/lib/services/shops/owner-write-http.ts — the HTTP answer to a refused owner write
// (owner-write.ts), as the owner or the admin reads it.
import { apiError } from "@/lib/api/errors";
import { SHOP_SUSPENDED_ADMIN_MESSAGE, SHOP_SUSPENDED_OWNER_MESSAGE } from "@/lib/shop-publication";
import type { OwnerShopWrite } from "./owner-write";

export function shopWriteRefusal(
  reason: Extract<OwnerShopWrite, { ok: false }>["reason"],
  actor: "owner" | "admin" = "owner"
): Response {
  switch (reason) {
    case "SUSPENDED":
      return actor === "admin"
        ? apiError("CONFLICT", SHOP_SUSPENDED_ADMIN_MESSAGE)
        : apiError("FORBIDDEN", SHOP_SUSPENDED_OWNER_MESSAGE);
    case "NOT_FOUND":
      return apiError("NOT_FOUND", "Boutique introuvable");
  }
}
