// POST /api/support/ai-respond — Claude AI auto-response for support tickets
import { NextRequest, NextResponse } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { z } from "zod";

const aiRespondSchema = z.object({
  ticketId: z.string().min(1),
  userMessage: z.string().min(1).max(5000),
  shopName: z.string().max(200).optional(),
});

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const parsed = aiRespondSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Champs invalides" }, { status: 400 });
    }
    const { ticketId, userMessage, shopName } = parsed.data;

    // Verify ticket belongs to a shop owned by this user
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { shop: { select: { ownerId: true } } },
    });
    if (!ticket || ticket.shop.ownerId !== userId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Get conversation history
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Build Claude messages
    const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

    // Ensure conversation starts with user message
    if (claudeMessages.length === 0 || claudeMessages[0].role !== "user") {
      claudeMessages.unshift({ role: "user", content: userMessage });
    }

    // Ensure alternating roles
    const cleanMessages: Anthropic.MessageParam[] = [];
    for (const msg of claudeMessages) {
      if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== msg.role) {
        cleanMessages.push(msg);
      }
    }

    // Search FAQ for relevant answers
    let faqContext = "";
    try {
      const words = userMessage.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
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
          faqContext = "\n\nFAQ PERTINENTES (utilise ces reponses si elles correspondent) :\n" +
            matches.map((m) => `Q: ${m.question}\nR: ${m.answer}`).join("\n\n");
        }
      }
    } catch {
      // Non-critical
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI non configuree (ANTHROPIC_API_KEY manquante)" }, { status: 503 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\nContexte : Boutique "${shopName}"${faqContext}`,
      messages: cleanMessages,
    });

    const aiText = response.content[0].type === "text" ? response.content[0].text : "";

    // Check for ESCALATE signal
    const isEscalated = aiText.startsWith("ESCALATE:");
    const cleanText = isEscalated ? aiText.replace("ESCALATE:", "").trim() : aiText;

    // Save AI message
    await prisma.supportMessage.create({
      data: {
        ticketId,
        role: "ai",
        content: cleanText,
      },
    });

    // Update ticket status
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

    return NextResponse.json({ success: true, escalated: isEscalated });
  } catch (error) {
    void error;
    return NextResponse.json({ error: "AI response failed" }, { status: 500 });
  }
}
