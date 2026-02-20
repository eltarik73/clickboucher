// GET /api/support/tickets/[ticketId] — Boucher: view ticket detail
// POST /api/support/tickets/[ticketId] — Boucher: send a message
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Helper: get boucher's shop IDs from Clerk userId
async function getBoucherShopIds(clerkId: string): Promise<string[]> {
  const shops = await prisma.shop.findMany({
    where: { ownerId: clerkId },
    select: { id: true },
  });
  return shops.map((s) => s.id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const { ticketId } = params;

    // Verify ownership through shop (not userId — avoids clerkId vs DB id mismatch)
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
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

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

    // Create message
    const message = await prisma.supportMessage.create({
      data: { ticketId, role: "user", content: data.content },
    });

    // Reopen ticket if it was resolved/closed
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "OPEN" },
      });
    }

    // Get shop name for AI context
    const shop = await prisma.shop.findUnique({
      where: { id: ticket.shopId },
      select: { name: true },
    });

    // Read cookie header while still in request context
    const headersList = headers();
    const cookieHeader = headersList.get("cookie") || "";

    // Trigger AI response
    triggerAIResponse(ticketId, data.content, shop?.name || "", cookieHeader).catch(() => {});

    return apiSuccess(message, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/message");
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
