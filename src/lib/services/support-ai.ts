// src/lib/services/support-ai.ts — Claude AI auto-response service for support tickets
// Pure async function — NO Request/Response. Safe to call from route handlers
// without internal fetch round-trips.
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const SYSTEM_PROMPT = `Tu es l'assistant support de Klik&Go, une plateforme de click & collect pour boucheries halal.
Tu aides les bouchers qui utilisent la plateforme avec leurs questions sur :
- La gestion de leur boutique (produits, catégories, horaires)
- Les commandes (acceptation, préparation, retrait)
- Les paramètres (notifications, mode occupé, pause)
- La facturation et les abonnements
- Les problèmes techniques

Règles :
1. Réponds TOUJOURS en français
2. Sois concis et utile (max 200 mots)
3. Si le problème nécessite une intervention humaine (bug technique, problème de paiement, litige client, demande de remboursement, problème de compte), commence ta réponse EXACTEMENT par "ESCALATE:" suivi de ta réponse
4. Si tu peux résoudre le problème toi-même (questions sur l'utilisation, conseils), réponds normalement
5. Sois professionnel et empathique`;

export interface GenerateAIResponseInput {
  ticketId: string;
  userMessage: string;
  shopName?: string;
}

export interface GenerateAIResponseResult {
  ok: boolean;
  escalated?: boolean;
  reason?: string;
}

/**
 * Generate an AI response for a support ticket and persist it.
 * Robust by design:
 * - If ANTHROPIC_API_KEY is missing, logs a warning and returns ok:false (no throw).
 * - On any error, logs and returns ok:false.
 */
export async function generateAIResponse(
  input: GenerateAIResponseInput
): Promise<GenerateAIResponseResult> {
  const { ticketId, userMessage, shopName } = input;

  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn("[support-ai] ANTHROPIC_API_KEY missing — skipping AI response", { ticketId });
    return { ok: false, reason: "missing_api_key" };
  }

  try {
    // Conversation history
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    if (claudeMessages.length === 0 || claudeMessages[0].role !== "user") {
      claudeMessages.unshift({ role: "user", content: userMessage });
    }

    // Ensure alternating roles
    const cleanMessages: Anthropic.MessageParam[] = [];
    for (const msg of claudeMessages) {
      if (
        cleanMessages.length === 0 ||
        cleanMessages[cleanMessages.length - 1].role !== msg.role
      ) {
        cleanMessages.push(msg);
      }
    }

    // FAQ context (best-effort)
    let faqContext = "";
    try {
      const words = userMessage
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2);
      if (words.length > 0) {
        const faqs = await prisma.fAQ.findMany({
          where: { active: true },
          select: { question: true, answer: true, keywords: true },
        });

        const matches = faqs
          .map((faq) => {
            let score = 0;
            const lower = `${faq.question} ${faq.answer}`.toLowerCase();
            for (const w of words) {
              if (lower.includes(w)) score += 2;
            }
            for (const kw of faq.keywords) {
              if (words.some((w: string) => kw.toLowerCase().includes(w))) score += 3;
            }
            return { ...faq, score };
          })
          .filter((f) => f.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (matches.length > 0) {
          faqContext =
            "\n\nFAQ PERTINENTES (utilise ces reponses si elles correspondent) :\n" +
            matches.map((m) => `Q: ${m.question}\nR: ${m.answer}`).join("\n\n");
        }
      }
    } catch (err) {
      logger.warn("[support-ai] FAQ lookup failed", { err: (err as Error)?.message });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\nContexte : Boutique "${shopName ?? ""}"${faqContext}`,
      messages: cleanMessages,
    });

    const aiText = response.content[0].type === "text" ? response.content[0].text : "";

    const isEscalated = aiText.startsWith("ESCALATE:");
    const cleanText = isEscalated ? aiText.replace("ESCALATE:", "").trim() : aiText;

    await prisma.supportMessage.create({
      data: {
        ticketId,
        role: "ai",
        content: cleanText,
      },
    });

    if (isEscalated) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "ESCALATED", escalatedAt: new Date() },
      });
    } else {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "AI_HANDLED" },
      });
    }

    return { ok: true, escalated: isEscalated };
  } catch (error) {
    logger.error("[support-ai] generation failed", {
      ticketId,
      err: (error as Error)?.message,
    });
    return { ok: false, reason: "generation_failed" };
  }
}
