// GET + POST /api/support/tickets — Boucher: list own tickets + create new ticket
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

// GET — List boucher's tickets
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      include: {
        shop: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(tickets);
  } catch (error) {
    return handleApiError(error, "support/tickets");
  }
}

const createTicketSchema = z.object({
  shopId: z.string().min(1),
  subject: z.string().min(1).max(300),
  message: z.string().min(1).max(5000),
});

// POST — Create a new ticket with initial message + AI auto-response
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();
    const data = createTicketSchema.parse(body);

    // Verify user owns the shop
    const shop = await prisma.shop.findFirst({
      where: { id: data.shopId, ownerId: userId },
      select: { id: true, name: true },
    });
    if (!shop) return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boutique");

    // Create ticket + initial message in transaction
    const ticket = await prisma.supportTicket.create({
      data: {
        shopId: data.shopId,
        userId,
        subject: data.subject,
        messages: {
          create: { role: "user", content: data.message },
        },
      },
      include: {
        messages: true,
      },
    });

    // Trigger AI auto-response asynchronously (don't await)
    triggerAIResponse(ticket.id, data.message, shop.name).catch(console.error);

    return apiSuccess(ticket, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/create");
  }
}

async function triggerAIResponse(ticketId: string, userMessage: string, shopName: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    await fetch(`${baseUrl}/api/support/ai-respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, userMessage, shopName }),
    });
  } catch {
    // Silent fail — AI response is best-effort
  }
}
