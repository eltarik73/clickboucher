// POST /api/support/ai-respond — Claude AI auto-response for support tickets
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const body = await req.json();
    const { ticketId, userMessage, shopName } = body;

    if (!ticketId || !userMessage) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

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

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\nContexte : Boutique "${shopName}"`,
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
    console.error("[AI Support]", error);
    return NextResponse.json({ error: "AI response failed" }, { status: 500 });
  }
}
