import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
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
  | "SCHEDULED_REMINDER";

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
};

// ─────────────────────────────────────────────
// Message templates (subject + HTML body)
// ─────────────────────────────────────────────
type Template = { subject: string; html: string; plainText: string };

function getTemplate(event: NotifEvent, data: NotifData): Template {
  switch (event) {
    case "ORDER_PENDING":
      return {
        subject: `\ud83d\udd14 Nouvelle commande #${data.orderNumber}`,
        html: tpl.orderPending(data),
        plainText: `Nouvelle commande de ${data.customerName || "un client"}. Connectez-vous pour accepter ou refuser.`,
      };

    case "ORDER_ACCEPTED":
      return {
        subject: `\u2705 Commande ${data.orderNumber} accept\u00e9e !`,
        html: tpl.orderAccepted(data),
        plainText: `Votre commande chez ${data.shopName} sera pr\u00eate dans environ ${data.estimatedMinutes} min.`,
      };

    case "ORDER_DENIED":
      return {
        subject: `\u274c Commande ${data.orderNumber} refus\u00e9e`,
        html: tpl.orderDenied(data),
        plainText: `D\u00e9sol\u00e9, ${data.shopName} n\u2019a pas pu accepter votre commande. Raison : ${data.denyReason}`,
      };

    case "ORDER_READY":
      return {
        subject: `\ud83c\udf89 Commande ${data.orderNumber} pr\u00eate !`,
        html: tpl.orderReady(data),
        plainText: `Votre commande est pr\u00eate chez ${data.shopName} ! Pr\u00e9sentez votre QR code au retrait.`,
      };

    case "ORDER_PICKED_UP":
      return {
        subject: `\ud83d\udce6 Commande ${data.orderNumber} r\u00e9cup\u00e9r\u00e9e`,
        html: tpl.orderPickedUp(data),
        plainText: `Merci pour votre achat chez ${data.shopName} !`,
      };

    case "STOCK_ISSUE":
      return {
        subject: `\u26a0\ufe0f Rupture partielle \u2014 Commande ${data.orderNumber}`,
        html: tpl.stockIssue(data),
        plainText: `Certains articles de votre commande chez ${data.shopName} ne sont plus disponibles.`,
      };

    case "PRO_VALIDATED":
      return {
        subject: `\ud83c\udf1f Compte Pro valid\u00e9 !`,
        html: tpl.proValidated(),
        plainText: `F\u00e9licitations ! Votre compte professionnel Klik&Go a \u00e9t\u00e9 valid\u00e9.`,
      };

    case "PRO_REJECTED":
      return {
        subject: `Demande Pro refus\u00e9e`,
        html: tpl.proRejected(),
        plainText: `Votre demande de compte professionnel n\u2019a pas \u00e9t\u00e9 valid\u00e9e.`,
      };

    case "SCHEDULED_REMINDER":
      return {
        subject: `\u23f0 Rappel \u2014 Commande ${data.orderNumber}`,
        html: tpl.orderReady(data),
        plainText: `Votre commande programm\u00e9e chez ${data.shopName} est bient\u00f4t pr\u00eate.`,
      };
  }
}

// ─────────────────────────────────────────────
// SMS / WhatsApp stubs
// ─────────────────────────────────────────────
export async function sendSms(to: string, body: string) {
  console.log(`\ud83d\udcf1 SMS \u2192 ${to}: ${body}`);
  // TODO: Twilio
  return true;
}

export async function sendWhatsapp(to: string, body: string) {
  console.log(`\ud83d\udcac WHATSAPP \u2192 ${to}: ${body}`);
  // TODO: Twilio WhatsApp ou API WhatsApp Business
  return true;
}

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────
export async function sendNotification(event: NotifEvent, data: NotifData) {
  try {
    const { subject, html, plainText } = getTemplate(event, data);
    const channels: string[] = [];

    // Determine recipient
    let email: string | null = null;
    let phone: string | null = null;
    let prefs = { notifEmail: true, notifSms: false, notifWhatsapp: false };

    if (event === "ORDER_PENDING" && data.shopId) {
      // Notify boucher (shop owner — ownerId is a clerkId)
      const shop = await prisma.shop.findUnique({
        where: { id: data.shopId },
        select: { ownerId: true },
      });
      if (shop?.ownerId) {
        const owner = await prisma.user.findUnique({
          where: { clerkId: shop.ownerId },
          select: { email: true, phone: true, notifEmail: true, notifSms: true, notifWhatsapp: true },
        });
        if (owner) {
          email = owner.email;
          phone = owner.phone;
          prefs = owner;
        }
      }
    } else if (data.userId) {
      // Notify client — userId can be clerkId or internal id
      let user = await prisma.user.findUnique({
        where: { clerkId: data.userId },
        select: { email: true, phone: true, notifEmail: true, notifSms: true, notifWhatsapp: true },
      });
      if (!user) {
        user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { email: true, phone: true, notifEmail: true, notifSms: true, notifWhatsapp: true },
        });
      }
      if (user) {
        email = user.email;
        phone = user.phone;
        prefs = user;
      }
    }

    // Send via enabled channels
    if (prefs.notifEmail && email) {
      await sendEmail(email, subject, html);
      channels.push("email");
    }

    if (prefs.notifSms && phone) {
      await sendSms(phone, plainText);
      channels.push("sms");
    }

    if (prefs.notifWhatsapp && phone) {
      await sendWhatsapp(phone, plainText);
      channels.push("whatsapp");
    }

    // Log notification on the order
    if (data.orderId && channels.length > 0) {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { notifSent: true },
      });

      const existing = Array.isArray(order?.notifSent) ? order.notifSent : [];
      const logEntry = {
        event,
        channels,
        at: new Date().toISOString(),
      };

      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          notifSent: [...existing, logEntry],
        },
      });
    }

    return { sent: channels.length > 0, channels };
  } catch (error) {
    console.error(`[notifications] Failed to send ${event}:`, error);
    return { sent: false, channels: [] };
  }
}
