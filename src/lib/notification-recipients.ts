// Destinataire d'une notification et ses préférences de canal.
import prisma from "@/lib/prisma";
import type { NotifData, NotifEvent } from "@/lib/notifications";
import { orderPersonColumns, typedGuestPerson } from "@/lib/services/orders/order-person";

export type NotificationRecipient = {
  id: string;
  email: string;
  phone: string | null;
  notifEmail: boolean;
  notifSms: boolean;
  notifWhatsapp: boolean;
  notifPush: boolean;
  pushSubscription: unknown;
};

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  phone: true,
  notifEmail: true,
  notifSms: true,
  notifWhatsapp: true,
  notifPush: true,
  pushSubscription: true,
} as const;

/** Événements adressés au propriétaire de la boutique `data.shopId`. */
const SHOP_OWNER_EVENTS: ReadonlySet<NotifEvent> = new Set<NotifEvent>([
  "ORDER_PENDING",
  "ORDER_CANCELLED_BY_CUSTOMER",
  "SCHEDULED_REMINDER",
  "PRICE_ADJUSTMENT_ACCEPTED",
  "PRICE_ADJUSTMENT_REJECTED",
  "PRICE_ADJUSTMENT_EXPIRED",
]);

/**
 * Propriétaire de la boutique pour les événements boucher ; sinon le client `data.userId`.
 * `shop.ownerId` comme `data.userId` peuvent contenir le clerkId ou l'id Prisma de l'utilisateur.
 */
export async function resolveNotificationRecipient(
  event: NotifEvent,
  data: NotifData
): Promise<NotificationRecipient | null> {
  if (SHOP_OWNER_EVENTS.has(event) && data.shopId) {
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { ownerId: true },
    });
    if (!shop?.ownerId) return null;
    return prisma.user.findFirst({
      where: { OR: [{ clerkId: shop.ownerId }, { id: shop.ownerId }] },
      select: RECIPIENT_SELECT,
    });
  }

  if (!data.userId) return null;
  const recipient =
    (await prisma.user.findUnique({ where: { clerkId: data.userId }, select: RECIPIENT_SELECT })) ??
    (await prisma.user.findUnique({ where: { id: data.userId }, select: RECIPIENT_SELECT }));
  if (recipient === null || !data.orderId) return recipient;
  return { ...recipient, phone: await orderContactPhone(data.orderId, recipient.phone) };
}

/**
 * Le téléphone auquel joindre le client d'une commande : celui saisi lors d'une commande invitée
 * (aucun s'il n'en a pas saisi), jamais celui de la ligne users sous laquelle elle est rangée, qui
 * peut appartenir à quelqu'un d'autre (src/lib/services/orders/order-person.ts) ; sinon celui de
 * la ligne users.
 */
async function orderContactPhone(orderId: string, rowPhone: string | null): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: orderPersonColumns,
  });
  const typed = order === null ? null : typedGuestPerson(order);
  return typed === null ? rowPhone : typed.phone;
}
