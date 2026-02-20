// GET + POST /api/support/tickets — Boucher: list own tickets + create new ticket
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/get-or-create-user";
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
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();
    const data = createTicketSchema.parse(body);

    // Verify user owns the shop
    const shop = await prisma.shop.findFirst({
      where: { id: data.shopId, ownerId: clerkId },
      select: { id: true, name: true },
    });
    if (!shop) return apiError("FORBIDDEN", "Vous n'etes pas proprietaire de cette boutique");

    // Get or create DB user (ensures valid foreign key)
    const dbUser = await getOrCreateUser(clerkId);
    if (!dbUser) return apiError("NOT_FOUND", "Utilisateur introuvable");

    // Create ticket + initial message in transaction
    const ticket = await prisma.supportTicket.create({
      data: {
        shopId: data.shopId,
        userId: dbUser.id,
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
