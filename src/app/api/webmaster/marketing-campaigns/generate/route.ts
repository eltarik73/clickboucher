// POST /api/webmaster/marketing-campaigns/generate — AI generation for campaigns
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const dynamic = "force-dynamic";

let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const schema = z.object({
  type: z.enum(["email_subject", "email_body", "banner_text", "popup_text", "promo_label", "sms_text"]),
  context: z.string().max(500).optional(),
  tone: z.string().max(100).optional(),
  promoDetails: z.string().max(300).optional(),
  targetAudience: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const client = getClient();
    if (!client) {
      return apiError("INTERNAL_ERROR", "IA non configurée (ANTHROPIC_API_KEY manquante)");
    }

    const body = await req.json();
    const data = schema.parse(body);

    const typePrompts: Record<string, string> = {
      email_subject: `Génère 3 sujets d'email marketing pour Klik&Go (boucheries halal click & collect).
Contexte: ${data.context || "promotion générale"}
Audience: ${data.targetAudience || "tous les clients"}
Ton: ${data.tone || "amical et professionnel"}
${data.promoDetails ? `Détails promo: ${data.promoDetails}` : ""}

Réponds UNIQUEMENT en JSON: {"suggestions": ["sujet1", "sujet2", "sujet3"]}`,

      email_body: `Génère un email HTML marketing pour Klik&Go (boucheries halal click & collect).
Contexte: ${data.context || "promotion générale"}
Audience: ${data.targetAudience || "tous les clients"}
Ton: ${data.tone || "amical et professionnel"}
${data.promoDetails ? `Détails promo: ${data.promoDetails}` : ""}

Le HTML doit:
- Être responsive (inline styles, max-width 600px)
- Couleur primaire #DC2626 (rouge)
- Logo texte "Klik&Go" en haut
- CTA bouton rouge
- En français
- Court et engageant (max 200 mots)

Réponds UNIQUEMENT en JSON: {"html": "<html>..."}`,

      banner_text: `Génère 3 textes courts pour une bannière promotionnelle Klik&Go (boucheries halal).
Contexte: ${data.context || "promotion"}
${data.promoDetails ? `Détails: ${data.promoDetails}` : ""}
Max 80 caractères chacun. Accrocheur et urgent.

Réponds UNIQUEMENT en JSON: {"suggestions": ["texte1", "texte2", "texte3"]}`,

      popup_text: `Génère un titre et message pour un popup promotionnel Klik&Go.
Contexte: ${data.context || "promotion"}
${data.promoDetails ? `Détails: ${data.promoDetails}` : ""}
Titre: max 50 caractères. Message: max 150 caractères.

Réponds UNIQUEMENT en JSON: {"title": "...", "message": "..."}`,

      promo_label: `Génère 3 labels courts pour un code promo Klik&Go (boucheries halal).
${data.promoDetails ? `Détails: ${data.promoDetails}` : ""}
Max 40 caractères. Clair et attractif.

Réponds UNIQUEMENT en JSON: {"suggestions": ["label1", "label2", "label3"]}`,

      sms_text: `Génère 3 SMS marketing courts pour Klik&Go (boucheries halal).
Contexte: ${data.context || "promotion"}
${data.promoDetails ? `Détails: ${data.promoDetails}` : ""}
Max 160 caractères. Incluant un appel à l'action.

Réponds UNIQUEMENT en JSON: {"suggestions": ["sms1", "sms2", "sms3"]}`,
    };

    const prompt = typePrompts[data.type];
    if (!prompt) {
      return apiError("VALIDATION_ERROR", "Type de génération invalide");
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return apiError("INTERNAL_ERROR", "Réponse IA invalide");
    }

    // Parse JSON from response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return apiError("INTERNAL_ERROR", "Format IA invalide");
    }

    const result = JSON.parse(jsonMatch[0]);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "marketing-campaigns/generate/POST");
  }
}
