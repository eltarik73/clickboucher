// GET /api/support/tickets/[ticketId] — Boucher: view ticket detail
// POST /api/support/tickets/[ticketId] — Boucher: send a message
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";
import { generateAIResponse } from "@/lib/services/support-ai";
import { rateLimits, checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Resolve the boucher's shop IDs.
 *
 * Multi-tenant ownership: a Shop.ownerId can store either the Clerk ID
 * (user_xxx) or the Prisma User.id (cm...). We must query with an OR clause
 * spanning both to avoid silently leaking/denying tickets when the data was
 * inserted under one form but the request comes in under another.
 *
 * Logs a warning if both forms resolve to disjoint shop sets — that means
 * legacy data drift exists and someone should reconcile.
 */
async function getBoucherShopIds(clerkId: string): Promise<string[]> {
  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  const ownerCandidates = dbUser ? [clerkId, dbUser.id] : [clerkId];

  const shops = await prisma.shop.findMany({
    where: { OR: ownerCandidates.map((ownerId) => ({ ownerId })) },
    select: { id: true, ownerId: true },
  });

  if (dbUser && shops.length > 0) {
    const byClerk = shops.filter((s) => s.ownerId === clerkId).length;
    const byDb = shops.filter((s) => s.ownerId === dbUser.id).length;
    if (byClerk > 0 && byDb > 0) {
      logger.warn("[support/tickets] inconsistent Shop.ownerId — both clerkId and dbUserId", {
        clerkId,
        dbUserId: dbUser.id,
        byClerk,
        byDb,
      });
    }
  }

  return shops.map((s) => s.id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const { ticketId } = params;

    const shopIds = await getBoucherShopIds(userId);
    if (shopIds.length === 0) return apiError("NOT_FOUND", "Aucune boutique trouvee");

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, shopId: { in: shopIds } },
      include: {
        shop: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) return apiError("NOT_FOUND", "Ticket introuvable");

    return apiSuccess(ticket);
  } catch (error) {
    return handleApiError(error, "support/tickets/[ticketId]");
  }
}

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Rate limit: 10 messages / hour per user
    const rl = await checkRateLimit(rateLimits.tickets, `ticket-msg:${userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de messages. Réessayez plus tard.");
    }

    const { ticketId } = params;
    const body = await req.json();
    const data = sendMessageSchema.parse(body);

    // Verify ownership through shop
    const shopIds = await getBoucherShopIds(userId);
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, shopId: { in: shopIds } },
      select: { id: true, status: true, shopId: true },
    });
    if (!ticket) return apiError("NOT_FOUND", "Ticket introuvable");

    // Atomic: create message + (optionally) reopen ticket
    const shouldReopen = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: { ticketId, role: "user", content: data.content },
      }),
      ...(shouldReopen
        ? [
            prisma.supportTicket.update({
              where: { id: ticketId },
              data: { status: "OPEN" },
            }),
          ]
        : []),
    ]);

    // Get shop name for AI context
    const shop = await prisma.shop.findUnique({
      where: { id: ticket.shopId },
      select: { name: true },
    });

    // Trigger AI response via direct service call (no internal fetch). Best-effort.
    generateAIResponse({
      ticketId,
      userMessage: data.content,
      shopName: shop?.name || "",
    }).catch((err) =>
      logger.warn("[support/tickets] AI response failed", {
        ticketId,
        err: (err as Error)?.message,
      })
    );

    return apiSuccess(message, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/message");
  }
}
