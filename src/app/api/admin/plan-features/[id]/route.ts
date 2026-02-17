// PATCH /api/admin/plan-features/[id] — Toggle or update a plan feature
// DELETE /api/admin/plan-features/[id]
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateFeatureSchema = z.object({
  featureName: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = params;
    const body = await req.json();
    const data = updateFeatureSchema.parse(body);

    const existing = await prisma.planFeature.findUnique({ where: { id } });
    if (!existing) {
      return apiError("NOT_FOUND", "Feature introuvable");
    }

    const updated = await prisma.planFeature.update({
      where: { id },
      data,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "admin/plan-features/update");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = params;

    await prisma.planFeature.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "admin/plan-features/delete");
  }
}
