// ═══════════════════════════════════════════════
// CLICKBOUCHER — Notification Service
// Twilio SMS + WhatsApp ready, stub fallback
// Switch via NOTIFICATION_PROVIDER env var
// ═══════════════════════════════════════════════

import { NotificationChannel } from "@prisma/client";
import prisma from "@/lib/prisma";

// ── Interface ────────────────────────────────

export interface NotificationPayload {
  userId: string;
  orderId?: string;
  channel: NotificationChannel;
  title: string;
  body: string;
}

export interface INotificationService {
  send(payload: NotificationPayload): Promise<void>;
  sendOrderUpdate(orderId: string, title: string, body: string): Promise<void>;
  sendSms(phone: string, message: string): Promise<void>;
  sendWhatsApp(phone: string, templateName: string, params: Record<string, string>): Promise<void>;
}

// ── WhatsApp Message Templates ───────────────
// Pre-approved templates for WhatsApp Business API

export const WA_TEMPLATES = {
  order_confirmed: {
    name: "order_confirmed",
    body: "✅ Commande {{orderNumber}} confirmée chez {{shopName}}. Montant : {{total}}. Préparation ~{{prepTime}} min.",
  },
  order_accepted: {
    name: "order_accepted",
    body: "👨‍🍳 {{shopName}} a accepté votre commande {{orderNumber}}. Préparation en cours !",
  },
  order_ready: {
    name: "order_ready",
    body: "🎉 Commande {{orderNumber}} prête chez {{shopName}} ! Rendez-vous au comptoir pour le retrait.",
  },
  weight_review: {
    name: "weight_review",
    body: "⚖️ Commande {{orderNumber}} : le poids dépasse +10%. Merci de valider le nouveau prix : {{newTotal}}. {{link}}",
  },
  stock_issue: {
    name: "stock_issue",
    body: "⚠️ Commande {{orderNumber}} : un produit n'est plus disponible. Votre boucher vous propose des alternatives. {{link}}",
  },
  order_cancelled: {
    name: "order_cancelled",
    body: "❌ Commande {{orderNumber}} annulée. Si un paiement a été effectué, il sera remboursé sous 5 jours.",
  },
  otp_code: {
    name: "otp_code",
    body: "🔐 Votre code ClickBoucher : {{code}}. Valide 5 minutes.",
  },
} as const;

// ── SMS Templates ────────────────────────────

export const SMS_TEMPLATES = {
  order_confirmed: "ClickBoucher: Commande {{orderNumber}} confirmée ({{total}}). Prépa ~{{prepTime}} min.",
  order_ready: "ClickBoucher: Commande {{orderNumber}} prête ! RDV au comptoir chez {{shopName}}.",
  weight_review: "ClickBoucher: Ajustement poids commande {{orderNumber}}. Validez ici : {{link}}",
  stock_issue: "ClickBoucher: Rupture stock commande {{orderNumber}}. Détails : {{link}}",
  otp_code: "ClickBoucher: Code {{code}}. Valide 5 min.",
} as const;

// ── Template Renderer ────────────────────────

function renderTemplate(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ── Stub Implementation ──────────────────────

class StubNotificationService implements INotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    console.log(`[STUB NOTIF] ${payload.channel} → ${payload.userId}: ${payload.title}`);
    console.log(`   Body: ${payload.body}`);
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        orderId: payload.orderId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
        sentAt: new Date(),
      },
    });
  }

  async sendOrderUpdate(orderId: string, title: string, body: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, guestPhone: true },
    });
    if (!order) return;
    if (order.userId) {
      await this.send({ userId: order.userId, orderId, channel: "SMS", title, body });
    } else if (order.guestPhone) {
      console.log(`[STUB NOTIF] SMS → guest ${order.guestPhone}: ${title} — ${body}`);
    }
  }

  async sendSms(phone: string, message: string): Promise<void> {
    console.log(`[STUB SMS] → ${phone}: ${message}`);
  }

  async sendWhatsApp(phone: string, templateName: string, params: Record<string, string>): Promise<void> {
    const template = WA_TEMPLATES[templateName as keyof typeof WA_TEMPLATES];
    const body = template ? renderTemplate(template.body, params) : `Template ${templateName} with params: ${JSON.stringify(params)}`;
    console.log(`[STUB WHATSAPP] → ${phone}: ${body}`);
  }
}

// ── Twilio Implementation ────────────────────

class TwilioNotificationService implements INotificationService {
  private getTwilio() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");
    const mod = "twilio";
    const twilio = require(/* webpackIgnore: true */ mod);
    return twilio(sid, token);
  }

  async send(payload: NotificationPayload): Promise<void> {
    // Resolve phone from user
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { phone: true } });
    if (!user?.phone) {
      console.warn(`[TWILIO] No phone for user ${payload.userId}`);
      return;
    }

    if (payload.channel === "WHATSAPP") {
      await this.sendWhatsApp(user.phone, "generic", { title: payload.title, body: payload.body });
    } else {
      await this.sendSms(user.phone, `${payload.title}\n${payload.body}`);
    }

    // Store in DB
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        orderId: payload.orderId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
        sentAt: new Date(),
      },
    });
  }

  async sendOrderUpdate(orderId: string, title: string, body: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, guestPhone: true },
    });
    if (!order) return;

    const phone = order.userId
      ? (await prisma.user.findUnique({ where: { id: order.userId }, select: { phone: true } }))?.phone
      : order.guestPhone;

    if (phone) {
      await this.sendSms(phone, `${title}\n${body}`);
    }

    if (order.userId) {
      await prisma.notification.create({
        data: { userId: order.userId, orderId, channel: "SMS", title, body, sentAt: new Date() },
      });
    }
  }

  async sendSms(phone: string, message: string): Promise<void> {
    try {
      const client = this.getTwilio();
      const from = process.env.TWILIO_PHONE_NUMBER;
      if (!from) throw new Error("TWILIO_PHONE_NUMBER not set");
      const result = await client.messages.create({ body: message, from, to: phone });
      console.log(`[TWILIO SMS] Sent ${result.sid} → ${phone}`);
    } catch (err) {
      console.error(`[TWILIO SMS] Error sending to ${phone}:`, err);
      throw err;
    }
  }

  async sendWhatsApp(phone: string, templateName: string, params: Record<string, string>): Promise<void> {
    try {
      const client = this.getTwilio();
      const from = process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
      const template = WA_TEMPLATES[templateName as keyof typeof WA_TEMPLATES];
      const body = template ? renderTemplate(template.body, params) : JSON.stringify(params);
      const result = await client.messages.create({ body, from: `whatsapp:${from.replace("whatsapp:", "")}`, to: `whatsapp:${phone.replace("whatsapp:", "")}` });
      console.log(`[TWILIO WA] Sent ${result.sid} → ${phone}`);
    } catch (err) {
      console.error(`[TWILIO WA] Error sending to ${phone}:`, err);
      throw err;
    }
  }
}

// ── Factory (env-based) ──────────────────────

function createNotificationService(): INotificationService {
  const provider = process.env.NOTIFICATION_PROVIDER || "stub";
  if (provider === "twilio" && process.env.TWILIO_ACCOUNT_SID) {
    console.log("[NOTIF] Provider: Twilio");
    return new TwilioNotificationService();
  }
  console.log("[NOTIF] Provider: Stub");
  return new StubNotificationService();
}

export const notificationService: INotificationService = createNotificationService();

// ── Convenience: order notification dispatcher ──

export async function notifyOrderStatus(
  orderId: string,
  status: string,
  extra: Record<string, string> = {}
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: { select: { name: true } }, user: { select: { phone: true } } },
  });
  if (!order) return;

  const phone = order.user?.phone || order.guestPhone;
  if (!phone) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params: Record<string, string> = {
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
    total: `${(order.totalCents / 100).toFixed(2)} €`,
    link: `${appUrl}/suivi/${order.id}`,
    ...extra,
  };

  const templateMap: Record<string, string> = {
    ACCEPTED: "order_accepted",
    READY: "order_ready",
    WEIGHT_REVIEW: "weight_review",
    STOCK_ISSUE: "stock_issue",
    CANCELLED: "order_cancelled",
  };

  const templateName = templateMap[status];
  if (!templateName) return;

  const smsTemplate = SMS_TEMPLATES[templateName as keyof typeof SMS_TEMPLATES];
  if (smsTemplate) {
    await notificationService.sendSms(phone, renderTemplate(smsTemplate, params));
  }
}
