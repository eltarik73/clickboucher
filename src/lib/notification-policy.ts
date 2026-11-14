// Politique de limitation des notifications, pure.
// Un événement transactionnel (commande, ajustement de prix, compte) n'est jamais limité : chaque
// transition n'a lieu qu'une fois et le destinataire doit en être informé. Seuls les envois
// marketing et les récapitulatifs gardent la limite d'un envoi par type et par heure.
import type { NotifEvent } from "@/lib/notifications";

export type NotificationThrottle = "none" | "hourly-per-type";

// Switch sans branche par défaut : ajouter un NotifEvent impose de choisir sa politique ici.
export function notificationThrottle(event: NotifEvent): NotificationThrottle {
  switch (event) {
    case "ORDER_PENDING":
    case "ORDER_ACCEPTED":
    case "ORDER_PREPARING":
    case "ORDER_DENIED":
    case "ORDER_READY":
    case "ORDER_PICKED_UP":
    case "ORDER_CANCELLED":
    case "ORDER_CANCELLED_BY_CUSTOMER":
    case "ORDER_EXPIRED":
    case "BOUCHER_NOTE":
    case "READY_REMINDER":
    case "STOCK_ISSUE":
    case "PRO_VALIDATED":
    case "PRO_REJECTED":
    case "SCHEDULED_REMINDER":
    case "ACCOUNT_APPROVED":
    case "PRICE_ADJUSTMENT_PENDING":
    case "PRICE_ADJUSTMENT_AUTO_APPROVED":
    case "PRICE_ADJUSTMENT_ACCEPTED":
    case "PRICE_ADJUSTMENT_REJECTED":
    case "PRICE_ADJUSTMENT_AUTO_VALIDATED":
    case "PRICE_ADJUSTMENT_ESCALATED":
    case "PICKUP_SOON":
      return "none";
    case "CART_ABANDONED":
    case "PROMO_NEW":
    case "FLASH_OFFER":
    case "LOYALTY_REWARD_EARNED":
    case "RECURRING_REMINDER":
    case "CALENDAR_ALERT":
    case "WEEKLY_REPORT":
      return "hourly-per-type";
  }
}
