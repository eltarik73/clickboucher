// PATCH  /api/webmaster/prospects/[id] — update status, notes, contact info
// DELETE /api/webmaster/prospects/[id] — remove prospect
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "REPLIED",
      "VISIT_SCHEDULED",
      "VISITED",
      "SIGNED",
      "REFUSED",
      "UNREACHABLE",
    ])
    .optional(),
  notes: z.string().max(2000).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  refusedReason: z.string().max(500).optional(),
  visitScheduledAt: z.string().datetime().optional(),
});

const STATUS_TIMESTAMP_MAP: Record<string, string> = {
  CONTACTED: "contactedAt",
  REPLIED: "repliedAt",
  VISIT_SCHEDULED: "visitScheduledAt",
  VISITED: "visitedAt",
  SIGNED: "signedAt",
  REFUSED: "refusedAt",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.prospect.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("NOT_FOUND", "Prospect introuvable");

    const updateData: Record<string, unknown> = {};
    if (data.status) {
      updateData.status = data.status;
      // Auto-stamp the timestamp matching the new status (only if not already set)
      const stampField = STATUS_TIMESTAMP_MAP[data.status];
      if (stampField && !existing[stampField as keyof typeof existing]) {
        updateData[stampField] = new Date();
      }
    }
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.refusedReason !== undefined) updateData.refusedReason = data.refusedReason || null;
    if (data.visitScheduledAt) updateData.visitScheduledAt = new Date(data.visitScheduledAt);

    const updated = await prisma.prospect.update({
      where: { id: params.id },
      data: updateData,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/prospects/PATCH");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    await prisma.prospect.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/prospects/DELETE");
  }
}
