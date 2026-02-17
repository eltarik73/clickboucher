// src/lib/notifications.ts — Centralized multichannel notification service
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppMessage, sendWhatsAppRaw } from "@/lib/whatsapp";
import { sendPushNotification, PushSubscriptionData } from "@/lib/push";
import * as tpl from "@/lib/email-templates";

// ─────────────────────────────────────────────
// Event types
// ─────────────────────────────────────────────
export type NotifEvent =
  | "ORDER_PENDING"
  | "ORDER_ACCEPTED"
  | "ORDER_DENIED"
  | "ORDER_READY"
  | "ORDER_PICKED_UP"
  | "STOCK_ISSUE"
  | "PRO_VALIDATED"
  | "PRO_REJECTED"
  | "SCHEDULED_REMINDER"
  | "CART_ABANDONED"
  | "ACCOUNT_APPROVED"
  | "RECURRING_REMINDER"
  | "TRIAL_EXPIRING"
  | "CALENDAR_ALERT"
  | "WEEKLY_REPORT";

export type NotifData = {
  userId?: string;
  shopId?: string;
  orderId?: string;
  orderNumber?: string;
  shopName?: string;
  estimatedMinutes?: number;
  qrCode?: string;
  denyReason?: string;
  customerName?: string;
  nbItems?: number;
  slot?: string;
  message?: string;
  // Weekly report data
  weeklyRevenue?: number;
  weeklyOrders?: number;
  weeklyAvgOrder?: number;
  weeklyRating?: number;
  weeklyTopProduct?: string;
};

// ─────────────────────────────────────────────
// Message templates (subject + HTML body + plainText)
// ─────────────────────────────────────────────
type Template = { subject: string; html: string; plainText: string };

function getTemplate(event: NotifEvent, data: NotifData): Template {
  switch (event) {
    case "ORDER_PENDING":
      return {
        subject: `🔔 Nouvelle commande #${data.orderNumber}`,
        html: tpl.orderPending(data),
        plainText: `Nouvelle commande de ${data.customerName || "un client"}. Connectez-vous pour accepter ou refuser.`,
      };

    case "ORDER_ACCEPTED":
      return {
        subject: `✅ Commande ${data.orderNumber} acceptée !`,
        html: tpl.orderAccepted(data),
        plainText: `Votre commande chez ${data.shopName} sera prête dans environ ${data.estimatedMinutes} min.`,
      };

    case "ORDER_DENIED":
      return {
        subject: `❌ Commande ${data.orderNumber} refusée`,
        html: tpl.orderDenied(data),
        plainText: `Désolé, ${data.shopName} n'a pas pu accepter votre commande. Raison : ${data.denyReason}`,
      };

    case "ORDER_READY":
      return {
        subject: `🎉 Commande ${data.orderNumber} prête !`,
        html: tpl.orderReady(data),
        plainText: `Votre commande est prête chez ${data.shopName} ! Présentez votre QR code au retrait.`,
      };

    case "ORDER_PICKED_UP":
      return {
        subject: `📦 Commande ${data.orderNumber} récupérée`,
        html: tpl.orderPickedUp(data),
        plainText: `Merci pour votre achat chez ${data.shopName} !`,
      };

    case "STOCK_ISSUE":
      return {
        subject: `⚠️ Rupture partielle — Commande ${data.orderNumber}`,
        html: tpl.stockIssue(data),
        plainText: `Certains articles de votre commande chez ${data.shopName} ne sont plus disponibles.`,
      };

    case "PRO_VALIDATED":
      return {
        subject: `🌟 Compte Pro validé !`,
        html: tpl.proValidated(),
        plainText: `Félicitations ! Votre compte professionnel Klik&Go a été validé.`,
      };

    case "PRO_REJECTED":
      return {
        subject: `Demande Pro refusée`,
        html: tpl.proRejected(),
        plainText: `Votre demande de compte professionnel n'a pas été validée.`,
      };

    case "CART_ABANDONED":
      return {
        subject: `🛒 Votre panier vous attend !`,
        html: tpl.cartAbandoned(data),
        plainText: `Vous avez ${data.nbItems || "des"} article(s) en attente chez ${data.shopName}. Finalisez votre commande !`,
      };

    case "ACCOUNT_APPROVED":
      return {
        subject: `🎉 Bienvenue sur Klik&Go !`,
        html: tpl.accountApproved(data),
        plainText: `Votre boutique ${data.shopName} est activée sur Klik&Go. Connectez-vous pour commencer.`,
      };

    case "RECURRING_REMINDER":
      return {
        subject: `🔄 Commande récurrente à confirmer`,
        html: tpl.orderReady(data), // Reuse ready template
        plainText: `Votre commande récurrente chez ${data.shopName} est prête à être confirmée.`,
      };

    case "TRIAL_EXPIRING":
      return {
        subject: `⏳ Votre essai se termine bientôt`,
        html: tpl.trialExpiring(data),
        plainText: data.message || `Votre essai gratuit se termine dans 7 jours. Passez au paiement pour continuer.`,
      };

    case "CALENDAR_ALERT":
      return {
        subject: data.message || `📅 Événement à venir`,
        html: tpl.calendarAlert(data),
        plainText: data.message || `Un événement important approche !`,
      };

    case "WEEKLY_REPORT":
      return {
        subject: `📊 Rapport hebdomadaire — ${data.shopName}`,
        html: tpl.weeklyReport(data),
        plainText: `Rapport hebdo ${data.shopName}: ${((data.weeklyRevenue || 0) / 100).toFixed(2)}€ CA, ${data.weeklyOrders || 0} commandes.`,
      };

    default:
      return {
        subject: `Notification Klik&Go`,
        html: `<p>${data.message || "Nouvelle notification"}</p>`,
        plainText: data.message || "Nouvelle notification",
      };
  }
}

// ─────────────────────────────────────────────
// Push notification title/body helpers
// ─────────────────────────────────────────────
function getPushPayload(event: NotifEvent, data: NotifData) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";

  switch (event) {
    case "ORDER_PENDING":
      return { title: "🔔 Nouvelle commande", body: `#${data.orderNumber} de ${data.customerName || "un client"}`, url: `${baseUrl}/boucher/commandes` };
    case "ORDER_ACCEPTED":
      return { title: "✅ Commande acceptée", body: `Chez ${data.shopName} — ~${data.estimatedMinutes} min`, url: `${baseUrl}/commandes` };
    case "ORDER_READY":
      return { title: "🎉 Commande prête !", body: `Chez ${data.shopName} — Récupérez-la !`, url: `${baseUrl}/commandes` };
    case "ORDER_DENIED":
      return { title: "❌ Commande refusée", body: data.denyReason || `Chez ${data.shopName}`, url: `${baseUrl}/commandes` };
    case "CART_ABANDONED":
      return { title: "🛒 Panier en attente", body: `${data.nbItems} article(s) chez ${data.shopName}`, url: `${baseUrl}/panier` };
    case "ACCOUNT_APPROVED":
      return { title: "🎉 Boutique activée !", body: `${data.shopName} est en ligne`, url: `${baseUrl}/boucher/dashboard` };
    default:
      return { title: "Klik&Go", body: data.message || "Nouvelle notification", url: baseUrl };
  }
}

// ─────────────────────────────────────────────
// WhatsApp template mapping
// ─────────────────────────────────────────────
function getWhatsAppTemplateKey(event: NotifEvent): string | null {
  switch (event) {
    case "ORDER_PENDING": return "NEW_ORDER";
    case "ORDER_ACCEPTED": return "ORDER_CONFIRMED";
    case "ORDER_READY": return "ORDER_READY";
    case "ORDER_DENIED": return "ORDER_DENIED";
    case "CART_ABANDONED": return "CART_ABANDONED";
    case "ACCOUNT_APPROVED": return "ACCOUNT_APPROVED";
    default: return null;
  }
}

// ─────────────────────────────────────────────
// Rate limiting: 1 notification per type per user per hour
// ─────────────────────────────────────────────
async function checkNotifRateLimit(userId: string, event: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.notification.count({
      where: {
        userId,
        type: event,
        createdAt: { gte: oneHourAgo },
      },
    });
    return recentCount === 0;
  } catch {
    return true; // Allow on error
  }
}

// ─────────────────────────────────────────────
// Resolve recipient internal user ID
// ─────────────────────────────────────────────
async function resolveRecipientId(event: NotifEvent, data: NotifData): Promise<string | null> {
  if (event === "ORDER_PENDING" && data.shopId) {
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { ownerId: true },
    });
    if (shop?.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { clerkId: shop.ownerId },
        select: { id: true },
      });
      return owner?.id ?? null;
    }
    return null;
  }
  if (data.userId) {
    const byClerk = await prisma.user.findUnique({
      where: { clerkId: data.userId },
      select: { id: true },
    });
    if (byClerk) return byClerk.id;
    const byId = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });
    return byId?.id ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────
// Resolve user with preferences
// ─────────────────────────────────────────────
type UserPrefs = {
  id: string;
  email: string;
  phone: string | null;
  notifEmail: boolean;
  notifSms: boolean;
  notifWhatsapp: boolean;
  notifPush: boolean;
  pushSubscription: unknown;
};

async function resolveUser(event: NotifEvent, data: NotifData): Promise<UserPrefs | null> {
  if (event === "ORDER_PENDING" && data.shopId) {
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { ownerId: true },
    });
    if (shop?.ownerId) {
      return prisma.user.findUnique({
        where: { clerkId: shop.ownerId },
        select: { id: true, email: true, phone: true, notifEmail: true, notifSms: true, notifWhatsapp: true, notifPush: true, pushSubscription: true },
      });
    }
    return null;
  }

  if (data.userId) {
    let user = await prisma.user.findUnique({
      where: { clerkId: data.userId },
      select: { id: true, email: true, phone: true, notifEmail: true, notifSms: true, notifWhatsapp: true, notifPush: true, pushSubscription: true },
    });
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, email: true, phone: true, notifEmail: true, notifSms: true, notifWhatsapp: true, notifPush: true, pushSubscription: true },
      });
    }
    return user;
  }

  return null;
}

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────
export async function sendNotification(event: NotifEvent, data: NotifData) {
  try {
    const { subject, html, plainText } = getTemplate(event, data);
    const channels: string[] = [];

    const user = await resolveUser(event, data);
    if (!user) {
      console.warn(`[notifications] No recipient found for ${event}`);
      return { sent: false, channels: [] };
    }

    // Rate limit check
    const allowed = await checkNotifRateLimit(user.id, event);
    if (!allowed) {
      console.log(`[notifications] Rate limited: ${event} for user ${user.id}`);
      return { sent: false, channels: [], rateLimited: true };
    }

    // ── Email ──
    if (user.notifEmail && user.email) {
      try {
        await sendEmail(user.email, subject, html);
        channels.push("email");
      } catch (e) {
        console.error("[notifications][email] Error:", (e as Error).message);
      }
    }

    // ── WhatsApp ──
    if (user.notifWhatsapp && user.phone) {
      try {
        const waTemplateKey = getWhatsAppTemplateKey(event);
        if (waTemplateKey) {
          await sendWhatsAppMessage(user.phone, waTemplateKey, {
            orderNumber: data.orderNumber || "",
            shopName: data.shopName || "",
            customerName: data.customerName || "",
            nbItems: String(data.nbItems || 0),
            slot: data.slot || "dès que possible",
            reason: data.denyReason || "",
          });
        } else {
          await sendWhatsAppRaw(user.phone, plainText);
        }
        channels.push("whatsapp");
      } catch (e) {
        console.error("[notifications][whatsapp] Error:", (e as Error).message);
      }
    }

    // ── Push ──
    if (user.notifPush && user.pushSubscription) {
      try {
        const sub = user.pushSubscription as PushSubscriptionData;
        if (sub.endpoint && sub.keys) {
          const payload = getPushPayload(event, data);
          const success = await sendPushNotification(sub, payload);
          if (success) {
            channels.push("push");
          } else {
            // Subscription expired — clear it
            await prisma.user.update({
              where: { id: user.id },
              data: { pushSubscription: Prisma.DbNull },
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error("[notifications][push] Error:", (e as Error).message);
      }
    }

    // Log notification on the order
    if (data.orderId && channels.length > 0) {
      try {
        const order = await prisma.order.findUnique({
          where: { id: data.orderId },
          select: { notifSent: true },
        });

        const existing = Array.isArray(order?.notifSent) ? order.notifSent : [];
        const logEntry = { event, channels, at: new Date().toISOString() };

        await prisma.order.update({
          where: { id: data.orderId },
          data: { notifSent: [...existing, logEntry] },
        });
      } catch {
        // Non-critical — don't fail the notification
      }
    }

    // Create in-app notification in DB
    const recipientId = await resolveRecipientId(event, data);
    if (recipientId) {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: event,
          message: plainText,
          orderId: data.orderId ?? null,
          channel: channels.includes("push") ? "PUSH" : channels.includes("whatsapp") ? "WHATSAPP" : channels.includes("email") ? "EMAIL" : "PUSH",
          delivered: channels.length > 0,
        },
      });
    }

    return { sent: channels.length > 0, channels };
  } catch (error) {
    console.error(`[notifications] Failed to send ${event}:`, error);
    return { sent: false, channels: [] };
  }
}
