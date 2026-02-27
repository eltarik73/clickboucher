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
  segment: string;
  objective: string;
  keywords: string[];
  tone?: string;
}): Promise<{ subject: string; htmlContent: string }> {
  const client = getClient();

  const segmentDesc: Record<string, string> = {
    ALL: "tous les clients",
    LOYAL: "les clients fidèles (3+ commandes)",
    INACTIVE: "les clients inactifs (pas de commande depuis 30j)",
    BUTCHERS: "les bouchers partenaires",
  };

  const prompt = `Tu es un expert marketing email pour Klik&Go, une plateforme de click & collect pour boucheries artisanales halal.

Génère un email marketing avec:
- Type: ${params.type}
- Audience: ${segmentDesc[params.segment] || params.segment}
- Objectif: ${params.objective}
- Mots-clés: ${params.keywords.join(", ") || "aucun"}
- Ton: ${params.tone || "amical et professionnel"}

Réponds UNIQUEMENT en JSON valide avec cette structure:
{"subject": "l'objet de l'email (max 60 chars)", "html": "le contenu HTML de l'email"}

Le HTML doit:
- Être un email responsive simple (inline styles)
- Utiliser la couleur primaire #DC2626 (rouge)
- Inclure le logo texte "Klik&Go" en haut
- Avoir un CTA clair (bouton rouge)
- Être en français
- Maximum 300 mots`;

  if (!client) {
    // Fallback stub
    return {
      subject: `[Klik&Go] ${params.objective.slice(0, 50)}`,
      htmlContent: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1 style="color:#DC2626">Klik&Go</h1>
<p>${params.objective}</p>
<a href="https://klikandgo.app" style="display:inline-block;background:#DC2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Découvrir →</a>
</div>`,
    };
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    const text = block && block.type === "text" ? block.text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || `[Klik&Go] ${params.objective.slice(0, 50)}`,
        htmlContent: parsed.html || parsed.htmlContent || text,
      };
    }

    return {
      subject: `[Klik&Go] ${params.objective.slice(0, 50)}`,
      htmlContent: text,
    };
  } catch (error) {
    console.error("[campaign] AI generation error:", error);
    throw new Error("Erreur lors de la génération du contenu IA");
  }
}

// ── Get recipients by segment ──
export async function getRecipientsBySegment(segment: string): Promise<{ email: string; firstName: string }[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  switch (segment) {
    case "LOYAL": {
      const users = await prisma.user.findMany({
        where: { totalOrders: { gte: 3 }, role: { in: ["CLIENT", "CLIENT_PRO"] } },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "INACTIVE": {
      // Users with at least 1 order but none in the last 30 days
      const users = await prisma.user.findMany({
        where: {
          role: { in: ["CLIENT", "CLIENT_PRO"] },
          orders: { some: {} },
          NOT: { orders: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "BUTCHERS": {
      const users = await prisma.user.findMany({
        where: { role: "BOUCHER" },
        select: { email: true, firstName: true },
      });
      return users;
    }
    case "ALL":
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

  const recipients = await getRecipientsBySegment(campaign.segment);
  let sentCount = 0;

  // Send in batches of 10 to avoid rate limits
  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((r) => {
        // Personalize content
        const html = campaign.htmlContent.replace(/\{\{prenom\}\}/g, r.firstName || "");
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
