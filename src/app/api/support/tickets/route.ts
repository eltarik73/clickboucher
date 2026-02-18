// GET + POST /api/support/tickets — Boucher: list own tickets + create new ticket
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — List boucher's tickets
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Look up by shop owner (boucher's tickets are per-shop)
    const shops = await prisma.shop.findMany({
      where: { ownerId: clerkId },
      select: { id: true },
    });
    const shopIds = shops.map((s) => s.id);

    const tickets = await prisma.supportTicket.findMany({
      where: { shopId: { in: shopIds } },
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
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();
    const data = createTicketSchema.parse(body);

    // Verify user owns the shop
    const shop = await prisma.shop.findFirst({
      where: { id: data.shopId, ownerId: clerkId },
      select: { id: true, name: true },
    });
    if (!shop) return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boutique");

    // Get DB user id for foreign key
    const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });

    // Create ticket + initial message in transaction
    const ticket = await prisma.supportTicket.create({
      data: {
        shopId: data.shopId,
        userId: dbUser?.id || clerkId,
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
    triggerAIResponse(ticket.id, data.message, shop.name).catch(() => {});

    return apiSuccess(ticket, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/create");
  }
}

async function triggerAIResponse(ticketId: string, userMessage: string, shopName: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
      || "http://localhost:3000";

    await fetch(`${baseUrl}/api/support/ai-respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, userMessage, shopName }),
    });
  } catch {
    // Silent fail — AI response is best-effort
  }
}
