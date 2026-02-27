// GET + POST /api/support/tickets — Boucher: list own tickets + create new ticket
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";

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

    // Create ticket + initial message in transaction
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

    // Read cookie header while still in request context for internal fetch
    const headersList = headers();
    const cookieHeader = headersList.get("cookie") || "";

    // Trigger AI auto-response asynchronously (don't await)
    triggerAIResponse(ticket.id, data.message, shop.name, cookieHeader).catch(() => {});

    return apiSuccess(ticket, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/create");
  }
}

async function triggerAIResponse(
  ticketId: string,
  userMessage: string,
  shopName: string,
  cookieHeader: string
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
      || "http://localhost:3000";

    await fetch(`${baseUrl}/api/support/ai-respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookieHeader,
      },
      body: JSON.stringify({ ticketId, userMessage, shopName }),
    });
  } catch {
    // Silent fail — AI response is best-effort
  }
}
