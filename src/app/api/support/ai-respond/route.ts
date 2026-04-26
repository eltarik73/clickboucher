// POST /api/support/ai-respond — Thin HTTP wrapper around the support-ai service.
// Internal callers should import generateAIResponse from "@/lib/services/support-ai" directly.
import { NextRequest, NextResponse } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { generateAIResponse } from "@/lib/services/support-ai";
import { logger } from "@/lib/logger";

const aiRespondSchema = z.object({
  ticketId: z.string().min(1),
  userMessage: z.string().min(1).max(5000),
  shopName: z.string().max(200).optional(),
});

export const dynamic = "force-dynamic";

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
    // OR clause — ownerId can be either Prisma user.id or Clerk user_xxx
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { shop: { select: { ownerId: true } } },
    });
    if (
      !ticket ||
      (ticket.shop.ownerId !== userId && ticket.shop.ownerId !== dbUser?.id)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI non configuree (ANTHROPIC_API_KEY manquante)" },
        { status: 503 }
      );
    }

    const result = await generateAIResponse({ ticketId, userMessage, shopName });
    if (!result.ok) {
      return NextResponse.json({ error: "Erreur du service IA" }, { status: 500 });
    }

    return NextResponse.json({ success: true, escalated: !!result.escalated });
  } catch (error) {
    logger.error("[support/ai-respond]", { err: (error as Error)?.message });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur du service IA" }, { status: 500 });
  }
}
