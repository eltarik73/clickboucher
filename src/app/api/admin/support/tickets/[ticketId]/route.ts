// GET /api/admin/support/tickets/[ticketId] — Ticket detail with messages
// PATCH /api/admin/support/tickets/[ticketId] — Update ticket status
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { ticketId } = params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        shop: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) {
      return apiError("NOT_FOUND", "Ticket introuvable");
    }

    return apiSuccess(ticket);
  } catch (error) {
    return handleApiError(error, "admin/support/tickets/[ticketId]");
  }
}

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "AI_HANDLED", "ESCALATED", "RESOLVED", "CLOSED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { ticketId } = params;
    const body = await req.json();
    const data = updateTicketSchema.parse(body);

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: data.status,
        ...(data.status === "RESOLVED" && { resolvedAt: new Date() }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "admin/support/tickets/update");
  }
}
