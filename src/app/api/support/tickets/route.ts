// GET + POST /api/support/tickets — Boucher: list own tickets + create new ticket
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { generateAIResponse } from "@/lib/services/support-ai";
import { rateLimits, checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET — List boucher's tickets
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const shopIds = [shopId];

    const tickets = await prisma.supportTicket.findMany({
      where: { shopId: { in: shopIds } },
      include: {
        shop: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
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
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { userId, shopId: authShopId } = authResult;

    // Rate limit: 10 ticket creations / hour per user
    const rl = await checkRateLimit(rateLimits.tickets, `ticket-create:${userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de tickets créés. Réessayez plus tard.");
    }

    const body = await req.json();
    const data = createTicketSchema.parse(body);

    // Verify the shop matches
    if (data.shopId !== authShopId) {
      return apiError("FORBIDDEN", "Vous n'etes pas proprietaire de cette boutique");
    }
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { id: true, name: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const dbUserId = userId;

    // Create ticket + initial message
    const ticket = await prisma.supportTicket.create({
      data: {
        shopId: data.shopId,
        userId: dbUserId,
        subject: data.subject,
        messages: {
          create: { role: "user", content: data.message },
        },
      },
      include: {
        messages: true,
      },
    });

    // Trigger AI auto-response via direct service call (no internal fetch).
    // Best-effort — we don't await to avoid blocking the response.
    generateAIResponse({
      ticketId: ticket.id,
      userMessage: data.message,
      shopName: shop.name,
    }).catch((err) =>
      logger.warn("[support/tickets] AI response failed", {
        ticketId: ticket.id,
        err: (err as Error)?.message,
      })
    );

    return apiSuccess(ticket, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/create");
  }
}
