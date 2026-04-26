// POST /api/admin/support/tickets/[ticketId]/reply — Admin reply to a ticket
//
// Behavior:
// - Always creates an admin reply message (atomic with optional close).
// - Setting `closeTicket: true` transitions the ticket to RESOLVED.
// - Replying to an ESCALATED ticket WITHOUT `closeTicket: true` no longer
//   auto-resolves it. Admins must opt-in explicitly to close. This avoids the
//   confusing implicit transition where a single nudge silently resolved a case.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { rateLimits, checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  content: z.string().min(1).max(5000),
  closeTicket: z.boolean().optional().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    // Rate limit (defensive — admin endpoint, but keeps us safe from script loops)
    const adminId = (admin as { userId?: string }).userId ?? "admin";
    const rl = await checkRateLimit(rateLimits.api, `admin-ticket-reply:${adminId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de requêtes. Réessayez plus tard.");
    }

    const { ticketId } = params;
    const body = await req.json();
    const data = replySchema.parse(body);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!ticket) {
      return apiError("NOT_FOUND", "Ticket introuvable");
    }

    // Create message + optionally close ticket. Auto-resolve on ESCALATED removed.
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
        : []),
    ]);

    return apiSuccess(message, 201);
  } catch (error) {
    return handleApiError(error, "admin/support/tickets/reply");
  }
}
