// POST /api/admin/support/tickets/[ticketId]/reply — Admin reply to a ticket
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  content: z.string().min(1).max(5000),
  closeTicket: z.boolean().optional().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { ticketId } = await params;
    const body = await req.json();
    const data = replySchema.parse(body);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!ticket) {
      return apiError("NOT_FOUND", "Ticket introuvable");
    }

    // Create message + optionally close ticket
    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId,
          role: "admin",
          content: data.content,
        },
      }),
      ...(data.closeTicket
        ? [
            prisma.supportTicket.update({
              where: { id: ticketId },
              data: { status: "RESOLVED", resolvedAt: new Date() },
            }),
          ]
        : ticket.status === "ESCALATED"
          ? [
              prisma.supportTicket.update({
                where: { id: ticketId },
                data: { status: "RESOLVED", resolvedAt: new Date() },
              }),
            ]
          : []),
    ]);

    return apiSuccess(message, 201);
  } catch (error) {
    return handleApiError(error, "admin/support/tickets/reply");
  }
}
