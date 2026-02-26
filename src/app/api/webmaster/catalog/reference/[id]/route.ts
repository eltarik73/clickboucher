// API: PATCH/DELETE /api/webmaster/catalog/reference/[id]
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { updateReferenceProductSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const { id } = params;
    const body = await req.json();
    const data = updateReferenceProductSchema.parse(body);

    const existing = await prisma.referenceProduct.findUnique({ where: { id } });
    if (!existing) return apiError("NOT_FOUND", "Produit de référence introuvable");

    const { categoryId, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (categoryId) updateData.category = { connect: { id: categoryId } };

    const product = await prisma.referenceProduct.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error, "PATCH /api/webmaster/catalog/reference/[id]");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const { id } = params;
    const existing = await prisma.referenceProduct.findUnique({ where: { id } });
    if (!existing) return apiError("NOT_FOUND", "Produit de référence introuvable");

    await prisma.referenceProduct.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "DELETE /api/webmaster/catalog/reference/[id]");
  }
}
