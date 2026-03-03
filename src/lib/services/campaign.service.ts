// Campaign service — AI-powered email generation + sending
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// ── Anthropic client (lazy singleton) ──
let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// ── AI: Generate email content ──
export async function generateEmailContent(params: {
  type: string;
  audience: string;
  objective: string;
  keywords: string[];
  tone?: string;
}): Promise<{ subject: string; body: string }> {
  const client = getClient();

  const audienceDesc: Record<string, string> = {
    CLIENTS_ALL: "tous les clients",
    CLIENTS_LOYAL: "les clients fidèles (3+ commandes)",
    CLIENTS_INACTIVE: "les clients inactifs (pas de commande depuis 30j)",
    CLIENTS_NEW: "les nouveaux clients (1ère commande)",
    BUTCHERS_ALL: "tous les bouchers partenaires",
    BUTCHERS_NEW: "les nouveaux bouchers",
    BUTCHERS_ACTIVE: "les bouchers actifs",
  };

  const prompt = `Tu es un expert marketing pour Klik&Go, une plateforme de click & collect pour boucheries halal.
Génère un email marketing professionnel.

Type : ${params.type}
Audience : ${audienceDesc[params.audience] || params.audience}
Objectif : ${params.objective}
Mots-clés : ${params.keywords.join(", ")}
Ton : ${params.tone || "professionnel et chaleureux"}

Réponds UNIQUEMENT en JSON :
{
  "subject": "Objet de l'email (max 60 chars)",
  "body": "Contenu HTML de l'email (h2, p, ul, strong, pas de style inline)"
}`;

  if (!client) {
    return {
      subject: `[${params.type}] ${params.objective}`,
      body: `<h2>${params.objective}</h2><p>Contenu généré automatiquement.</p>`,
    };
  }

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { subject: params.objective, body: `<p>${text}</p>` };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return { subject: parsed.subject || params.objective, body: parsed.body || parsed.htmlContent || "" };
}

// ── Get recipients by audience segment ──
async function getRecipientsByAudience(audience: string): Promise<{ email: string; firstName: string | null }[]> {
  switch (audience) {
    case "CLIENTS_LOYAL": {
      const users = await prisma.user.findMany({
        where: { role: { in: ["CLIENT", "CLIENT_PRO"] }, totalOrders: { gte: 3 } },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "CLIENTS_INACTIVE": {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const users = await prisma.user.findMany({
        where: {
          role: { in: ["CLIENT", "CLIENT_PRO"] },
          orders: { none: { createdAt: { gte: thirtyDaysAgo } } },
        },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "CLIENTS_NEW": {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const users = await prisma.user.findMany({
        where: { role: { in: ["CLIENT", "CLIENT_PRO"] }, createdAt: { gte: sevenDaysAgo } },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "BUTCHERS_ALL": {
      const users = await prisma.user.findMany({
        where: { role: "BOUCHER" },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "BUTCHERS_NEW": {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const users = await prisma.user.findMany({
        where: { role: "BOUCHER", createdAt: { gte: thirtyDaysAgo } },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "BUTCHERS_ACTIVE": {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const users = await prisma.user.findMany({
        where: {
          role: "BOUCHER",
          orders: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "CLIENTS_ALL":
    default: {
      const users = await prisma.user.findMany({
        where: { role: { in: ["CLIENT", "CLIENT_PRO"] } },
        select: { email: true, firstName: true },
      });
      return users;
    }
  }
}

// ── Send campaign ──
export async function sendCampaign(campaignId: string): Promise<{ sentCount: number }> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status === "SENT") throw new Error("Campagne déjà envoyée");

  const recipients = await getRecipientsByAudience(campaign.audience);
  let sentCount = 0;

  // Send in batches of 10 to avoid rate limits
  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((r) => {
        const html = campaign.body.replace(/\{\{prenom\}\}/g, r.firstName || "");
        return sendEmail(r.email, campaign.subject, html);
      })
    );
    sentCount += results.filter((r) => r.status === "fulfilled" && r.value).length;
  }

  // Update campaign
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      sentCount,
    },
  });

  return { sentCount };
}
