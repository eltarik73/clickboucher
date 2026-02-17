// GET /api/support/tickets/[ticketId] — Boucher: view ticket detail
// POST /api/support/tickets/[ticketId] — Boucher: send a message
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const { ticketId } = await params;

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
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
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const { ticketId } = await params;
    const body = await req.json();
    const data = sendMessageSchema.parse(body);

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
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

    // Trigger AI response
    triggerAIResponse(ticketId, data.content, shop?.name || "").catch(console.error);

    return apiSuccess(message, 201);
  } catch (error) {
    return handleApiError(error, "support/tickets/message");
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
    // Silent fail
  }
}
