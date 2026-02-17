// src/lib/whatsapp.ts — Twilio WhatsApp integration (graceful fallback if not configured)

type WhatsAppTemplate = {
  body: string;
};

const TEMPLATES: Record<string, (data: Record<string, string>) => WhatsAppTemplate> = {
  ORDER_CONFIRMED: (d) => ({
    body: `✅ Votre commande #${d.orderNumber} chez ${d.shopName} est confirmée ! Retrait prévu : ${d.slot || "dès que possible"}`,
  }),
  ORDER_READY: (d) => ({
    body: `🔔 Votre commande #${d.orderNumber} chez ${d.shopName} est PRÊTE ! Présentez-vous au retrait.`,
  }),
  ORDER_DENIED: (d) => ({
    body: `❌ Votre commande #${d.orderNumber} chez ${d.shopName} a été refusée. ${d.reason || ""}`.trim(),
  }),
  NEW_ORDER: (d) => ({
    body: `🔔 Nouvelle commande #${d.orderNumber} de ${d.customerName || "un client"} ! Connectez-vous pour accepter.`,
  }),
  CART_ABANDONED: (d) => ({
    body: `🛒 Votre panier chez ${d.shopName} vous attend (${d.nbItems} article${Number(d.nbItems) > 1 ? "s" : ""}). Commandez maintenant !`,
  }),
  ACCOUNT_APPROVED: (d) => ({
    body: `🎉 Bienvenue sur Klik&Go ! Votre boutique ${d.shopName} est activée. Connectez-vous pour commencer.`,
  }),
};

function getTwilioClient(): { accountSid: string; authToken: string; from: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return null;
  }

  return { accountSid, authToken, from };
}

export async function sendWhatsAppMessage(
  to: string,
  templateKey: string,
  data: Record<string, string>
): Promise<boolean> {
  const template = TEMPLATES[templateKey];
  if (!template) {
    console.warn(`[whatsapp] Unknown template: ${templateKey}`);
    return false;
  }

  const { body } = template(data);
  return sendWhatsAppRaw(to, body);
}

export async function sendWhatsAppRaw(to: string, body: string): Promise<boolean> {
  const config = getTwilioClient();

  if (!config) {
    console.log(`📱 WHATSAPP (stub) → ${to}: ${body}`);
    return true;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const formattedFrom = config.from.startsWith("whatsapp:") ? config.from : `whatsapp:${config.from}`;

    const params = new URLSearchParams({
      To: formattedTo,
      From: formattedFrom,
      Body: body,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[whatsapp] Twilio error:", response.status, err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[whatsapp] Send failed:", (error as Error).message);
    return false;
  }
}
