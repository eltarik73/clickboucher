// @vitest-environment node
// Interrupteur « Envoi des e-mails commerciaux » sur PostgreSQL réel (décision du propriétaire du
// 2026-11-15). En pause par défaut : campagne, relance de panier abandonné, relance de prospect et
// e-mail manuel à un prospect n'envoient rien et le disent, sans rien changer en base. Activé par un
// admin (PUT audité, Zod strict), les mêmes opérations envoient. Les e-mails de commande partent dans
// les deux états. Simulés : transports (e-mail, push, WhatsApp) et helpers d'auth (admin, cron).
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ admin: null as unknown, withinRateLimit: true }));

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn(async () => session.admin) }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: vi.fn(() => true) }));
// Upstash : frontière réseau, simulée pour ne pas dépendre des variables UPSTASH du shell.
vi.mock("@/lib/rate-limit", () => ({
  rateLimits: { api: null },
  checkRateLimit: vi.fn(async () => ({ success: session.withinRateLimit })),
}));

import { sendEmail } from "@/lib/email";
import { apiError } from "@/lib/api/errors";
import {
  COMMERCIAL_EMAILS_CONFIG_KEY,
  COMMERCIAL_EMAILS_PAUSED_MESSAGE,
  commercialEmailsEnabled,
} from "@/lib/commercial-emails";
import { executeCampaignSend } from "@/lib/marketing/send-campaign";
import { sendNotification } from "@/lib/notifications";
import { GET as getSwitch, PUT as putSwitch } from "@/app/api/webmaster/commercial-emails/route";
import { POST as sendCampaignRoute } from "@/app/api/dashboard/campaigns/[campaignId]/send/route";
import { GET as abandonedCartsCron } from "@/app/api/cron/abandoned-carts/route";
import { GET as prospectRelancesCron } from "@/app/api/cron/prospect-relances/route";
import { POST as sendProspectEmailRoute } from "@/app/api/webmaster/prospects/[id]/send-email/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const ADMIN_CLERK_ID = "user_admin_itest";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

beforeEach(() => {
  session.admin = { userId: ADMIN_CLERK_ID };
  session.withinRateLimit = true;
  vi.mocked(sendEmail).mockReset().mockResolvedValue(true);
});

function asNonAdmin() {
  session.admin = { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };
}

function putRequest(body: string) {
  return new NextRequest("http://localhost/api/webmaster/commercial-emails", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function switchOnThroughRoute() {
  const res = await putSwitch(putRequest(JSON.stringify({ enabled: true })));
  expect(res.status).toBe(200);
}

async function bodyOf(res: Response) {
  return (await res.json()) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  };
}

function cronRequest(path: string) {
  return new NextRequest(`http://localhost/api/cron/${path}`);
}

/** Deux clients avec e-mail : l'audience CLIENTS_ALL d'une campagne. */
async function campaignWithTwoRecipients(status: "DRAFT" | "SCHEDULED" = "DRAFT") {
  const first = await createTestUser();
  const second = await createTestUser();
  const campaign = await prisma.campaign.create({
    data: {
      title: "Offre de l'Aïd",
      type: "NEWSLETTER",
      audience: "CLIENTS_ALL",
      subject: "L'Aïd approche",
      body: "Commandez votre viande pour l'Aïd.",
      status,
    },
  });
  return { campaign, recipients: [first.email, second.email] };
}

/** Panier non vide, laissé 3 h plus tôt : le cron le traite (seuil de 2 h). */
async function abandonedCart() {
  const customer = await createTestUser();
  const shop = await createTestShop({ name: "Boucherie du Lac" });
  const product = await createTestProduct(shop.id);
  const cart = await prisma.cart.create({
    data: {
      userId: customer.id,
      shopId: shop.id,
      items: { create: { productId: product.id, quantity: 1, weightGrams: 500 } },
    },
  });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date(Date.now() - 3 * HOUR_MS) },
  });
  return { customer, cart };
}

/** Prospect contacté une fois il y a 3 jours et demi : dû pour la relance à 3 jours. */
async function prospectDueForFirstRelance() {
  return prisma.prospect.create({
    data: {
      name: "Boucherie Savoie",
      city: "Chambéry",
      email: "contact@boucherie-savoie.itest",
      status: "CONTACTED",
      emailsSentCount: 1,
      lastEmailAt: new Date(Date.now() - 3.5 * DAY_MS),
    },
  });
}

async function newProspect() {
  return prisma.prospect.create({
    data: {
      name: "Boucherie des Alpes",
      city: "Grenoble",
      email: "contact@boucherie-alpes.itest",
    },
  });
}

function sendProspectEmail(prospectId: string) {
  return sendProspectEmailRoute(
    new NextRequest(`http://localhost/api/webmaster/prospects/${prospectId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "initial" }),
    }),
    { params: { id: prospectId } }
  );
}

function sendCampaign(campaignId: string) {
  return sendCampaignRoute(
    new NextRequest(`http://localhost/api/dashboard/campaigns/${campaignId}/send`, {
      method: "POST",
    }),
    { params: { campaignId } }
  );
}

describe("état par défaut", () => {
  it("sans ligne en base, l'interrupteur est en pause et la route le dit", async () => {
    expect(await commercialEmailsEnabled()).toBe(false);

    const res = await getSwitch();

    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toEqual({ success: true, data: { enabled: false } });
  });

  it.each(["TRUE", "1", "", " true", "oui"])(
    "une valeur stockée « %s » vaut pause (seul 'true' active)",
    async (value) => {
      await prisma.platformConfig.create({ data: { key: COMMERCIAL_EMAILS_CONFIG_KEY, value } });

      expect(await commercialEmailsEnabled()).toBe(false);
    }
  );

  // Témoin : sans lui, un lecteur qui répond toujours false passerait le cas ci-dessus.
  it("la valeur stockée 'true' vaut activé", async () => {
    await prisma.platformConfig.create({
      data: { key: COMMERCIAL_EMAILS_CONFIG_KEY, value: "true" },
    });

    expect(await commercialEmailsEnabled()).toBe(true);
  });
});

describe("en pause : rien ne part et chaque réponse le dit", () => {
  it("une campagne n'est pas envoyée et reste exactement telle qu'elle était", async () => {
    const { campaign } = await campaignWithTwoRecipients();
    const before = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });

    const result = await executeCampaignSend(campaign.id);

    expect(result).toEqual({ status: "PAUSED" });
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(after).toEqual(before);
    expect(after.status).toBe("DRAFT");
    expect(after.sentAt).toBeNull();
  });

  it("la route d'envoi de campagne répond 409 avec la phrase française et repasse la campagne programmée en brouillon", async () => {
    const { campaign } = await campaignWithTwoRecipients("SCHEDULED");

    const res = await sendCampaign(campaign.id);

    expect(res.status).toBe(409);
    expect(await bodyOf(res)).toEqual({
      success: false,
      error: { code: "CONFLICT", message: COMMERCIAL_EMAILS_PAUSED_MESSAGE },
    });
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    // Nothing sends a SCHEDULED campaign later: back to draft, to be sent once the switch is on.
    expect(after).toMatchObject({ status: "DRAFT", sentAt: null, sentCount: 0 });
  });

  it("le cron des paniers abandonnés marque le panier mais n'envoie aucune relance", async () => {
    const { customer, cart } = await abandonedCart();

    const res = await abandonedCartsCron(cronRequest("abandoned-carts"));

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.data).toMatchObject({
      markedCount: 1,
      remindersSent: 0,
      commercialEmailsPaused: true,
    });
    const stamped = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } });
    expect(stamped.abandonedAt).toBeInstanceOf(Date);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    const reminders = await prisma.notification.count({
      where: { userId: customer.id, type: "CART_ABANDONED" },
    });
    expect(reminders).toBe(0);
  });

  it("le cron des relances de prospects n'envoie rien et ne touche pas au prospect", async () => {
    const prospect = await prospectDueForFirstRelance();

    const res = await prospectRelancesCron(cronRequest("prospect-relances"));

    expect(res.status).toBe(200);
    expect((await bodyOf(res)).data).toMatchObject({
      relance3jSent: 0,
      relance7jSent: 0,
      candidatesScanned: 0,
      commercialEmailsPaused: true,
    });
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    const after = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(after.emailsSentCount).toBe(1);
    expect(after.lastEmailAt).toEqual(prospect.lastEmailAt);
  });

  it("l'e-mail manuel à un prospect répond 409 et le prospect reste NEW", async () => {
    const prospect = await newProspect();

    const res = await sendProspectEmail(prospect.id);

    expect(res.status).toBe(409);
    expect(await bodyOf(res)).toEqual({
      success: false,
      error: { code: "CONFLICT", message: COMMERCIAL_EMAILS_PAUSED_MESSAGE },
    });
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    const after = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(after).toMatchObject({
      status: "NEW",
      emailsSentCount: 0,
      lastEmailAt: null,
      contactedAt: null,
    });
  });
});

describe("PUT /api/webmaster/commercial-emails", () => {
  it("refuse un non-admin avec l'erreur d'auth et n'écrit rien", async () => {
    asNonAdmin();

    const res = await putSwitch(putRequest(JSON.stringify({ enabled: true })));

    expect(res.status).toBe(403);
    expect(await prisma.platformConfig.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("répond 429 au-delà de la limite de débit et n'écrit rien", async () => {
    session.withinRateLimit = false;

    const res = await putSwitch(putRequest(JSON.stringify({ enabled: true })));

    expect(res.status).toBe(429);
    expect((await bodyOf(res)).error?.code).toBe("RATE_LIMITED");
    expect(await prisma.platformConfig.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("refuse aussi la lecture à un non-admin", async () => {
    asNonAdmin();

    const res = await getSwitch();

    expect(res.status).toBe(403);
  });

  it.each([
    ["un booléen en texte", JSON.stringify({ enabled: "yes" })],
    ["une clé en trop", JSON.stringify({ enabled: true, key: "default_commission_pct" })],
    ["un corps sans enabled", JSON.stringify({})],
    ["un JSON mal formé", "{enabled"],
  ])("répond 400 VALIDATION_ERROR à %s et n'écrit rien", async (_label, raw) => {
    const res = await putSwitch(putRequest(raw));

    expect(res.status).toBe(400);
    expect((await bodyOf(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(await prisma.platformConfig.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
    expect(await commercialEmailsEnabled()).toBe(false);
  });

  it("active puis remet en pause, chaque changement audité avec l'admin et l'état d'avant", async () => {
    const on = await putSwitch(putRequest(JSON.stringify({ enabled: true })));

    expect(on.status).toBe(200);
    expect(await bodyOf(on)).toEqual({ success: true, data: { enabled: true } });
    expect(await commercialEmailsEnabled()).toBe(true);
    expect(await bodyOf(await getSwitch())).toEqual({ success: true, data: { enabled: true } });

    const off = await putSwitch(putRequest(JSON.stringify({ enabled: false })));

    expect(await bodyOf(off)).toEqual({ success: true, data: { enabled: false } });
    const row = await prisma.platformConfig.findUniqueOrThrow({
      where: { key: COMMERCIAL_EMAILS_CONFIG_KEY },
    });
    expect(row.value).toBe("false");
    const audit = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(
      audit.map(({ actorId, action, target, targetId, details }) => ({
        actorId,
        action,
        target,
        targetId,
        details,
      }))
    ).toEqual([
      {
        actorId: ADMIN_CLERK_ID,
        action: "commercial_emails.toggle",
        target: "PlatformConfig",
        targetId: "commercial_emails_enabled",
        details: { from: false, to: true },
      },
      {
        actorId: ADMIN_CLERK_ID,
        action: "commercial_emails.toggle",
        target: "PlatformConfig",
        targetId: "commercial_emails_enabled",
        details: { from: true, to: false },
      },
    ]);
  });
});

describe("activé par un admin : les mêmes opérations envoient", () => {
  beforeEach(switchOnThroughRoute);

  it("la campagne part aux deux destinataires et passe SENT avec sentCount 2", async () => {
    const { campaign, recipients } = await campaignWithTwoRecipients();

    const result = await executeCampaignSend(campaign.id);

    expect(result).toEqual({ status: "SENT", sent: 2, total: 2 });
    const sentTo = vi.mocked(sendEmail).mock.calls.map(([to, subject]) => ({ to, subject }));
    expect(sentTo).toHaveLength(2);
    expect(sentTo).toEqual(
      expect.arrayContaining(recipients.map((to) => ({ to, subject: "L'Aïd approche" })))
    );
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(after).toMatchObject({ status: "SENT", sentCount: 2 });
    expect(after.sentAt).toBeInstanceOf(Date);
  });

  it("la route d'envoi de campagne répond 200 avec le décompte", async () => {
    const { campaign } = await campaignWithTwoRecipients("SCHEDULED");

    const res = await sendCampaign(campaign.id);

    expect(res.status).toBe(200);
    expect((await bodyOf(res)).data).toMatchObject({ sent: 2, total: 2 });
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(after.status).toBe("SENT");
  });

  it("le transport n'accepte aucun e-mail : la route répond une erreur et la campagne reste en brouillon", async () => {
    vi.mocked(sendEmail).mockResolvedValue(false);
    const { campaign } = await campaignWithTwoRecipients("SCHEDULED");

    const res = await sendCampaign(campaign.id);

    expect(res.status).toBe(503);
    expect(await bodyOf(res)).toEqual({
      success: false,
      error: {
        code: "SERVICE_DISABLED",
        message: "Aucun e-mail n'a pu être envoyé. La campagne reste en brouillon.",
      },
    });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(2);
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(after).toMatchObject({ status: "DRAFT", sentAt: null, sentCount: 0 });
  });

  it("un seul e-mail accepté sur deux : la campagne passe SENT avec sentCount 1", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { campaign } = await campaignWithTwoRecipients();

    const result = await executeCampaignSend(campaign.id);

    expect(result).toEqual({ status: "SENT", sent: 1, total: 2 });
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(after).toMatchObject({ status: "SENT", sentCount: 1 });
    expect(after.sentAt).toBeInstanceOf(Date);
  });

  it("le cron des paniers abandonnés envoie la relance et la compte", async () => {
    const { customer, cart } = await abandonedCart();

    const res = await abandonedCartsCron(cronRequest("abandoned-carts"));

    expect((await bodyOf(res)).data).toMatchObject({
      markedCount: 1,
      remindersSent: 1,
      commercialEmailsPaused: false,
    });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      customer.email,
      "🛒 Votre panier vous attend !",
      expect.stringContaining("Boucherie du Lac")
    );
    const stamped = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } });
    expect(stamped.abandonedAt).toBeInstanceOf(Date);
    const reminders = await prisma.notification.findMany({
      where: { userId: customer.id, type: "CART_ABANDONED" },
    });
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ channel: "EMAIL", delivered: true });
  });

  it("le cron des relances de prospects envoie la relance à 3 jours et la compte", async () => {
    const prospect = await prospectDueForFirstRelance();

    const res = await prospectRelancesCron(cronRequest("prospect-relances"));

    expect((await bodyOf(res)).data).toMatchObject({
      relance3jSent: 1,
      relance7jSent: 0,
      candidatesScanned: 1,
      commercialEmailsPaused: false,
    });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      "contact@boucherie-savoie.itest",
      "Re: Klik&Go — Une rapide question pour votre boucherie",
      expect.stringContaining("Boucherie Savoie")
    );
    const after = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(after.emailsSentCount).toBe(2);
  });

  it("l'e-mail manuel au prospect part et le prospect passe CONTACTED", async () => {
    const prospect = await newProspect();

    const res = await sendProspectEmail(prospect.id);

    expect(res.status).toBe(200);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      "contact@boucherie-alpes.itest",
      "Klik&Go — La plateforme click & collect gratuite pour les boucheries halal",
      expect.stringContaining("Boucherie des Alpes")
    );
    const after = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(after).toMatchObject({ status: "CONTACTED", emailsSentCount: 1 });
    expect(after.contactedAt).toBeInstanceOf(Date);
  });
});

describe("les e-mails de commande ne dépendent jamais de l'interrupteur", () => {
  it.each([
    ["en pause", async () => {}, false],
    ["activé", switchOnThroughRoute, true],
  ])("ORDER_ACCEPTED est envoyé au client, interrupteur %s", async (_label, setSwitch, enabled) => {
    await setSwitch();
    expect(await commercialEmailsEnabled()).toBe(enabled);
    const customer = await createTestUser();
    const shop = await createTestShop({ name: "Boucherie du Lac" });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      overrides: { orderNumber: "KG26-000166" },
    });

    const result = await sendNotification("ORDER_ACCEPTED", {
      userId: customer.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: shop.name,
      estimatedMinutes: 20,
    });

    expect(result).toEqual({ sent: true, channels: ["email"] });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      customer.email,
      "✅ Commande KG26-000166 acceptée !",
      expect.stringContaining("KG26-000166")
    );
  });
});
