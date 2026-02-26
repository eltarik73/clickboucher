// PATCH /api/webmaster/api-keys/[id] — Toggle active / update settings
// DELETE /api/webmaster/api-keys/[id] — Permanently delete a key
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  scopes: z.array(z.string()).min(1).optional(),
  rateLimit: z.number().int().min(1).max(1000).optional(),
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
    const data = patchSchema.parse(body);

    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return apiError("NOT_FOUND", "Clé API introuvable");
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.scopes !== undefined && { scopes: data.scopes }),
        ...(data.rateLimit !== undefined && { rateLimit: data.rateLimit }),
      },
    });

    await writeAuditLog({
      actorId: admin.userId,
      action: data.isActive === false ? "apikey.revoke" : "apikey.update",
      target: "ApiKey",
      targetId: id,
      details: {
        name: existing.name,
        changes: data,
      },
    });

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      isActive: updated.isActive,
      scopes: updated.scopes,
      rateLimit: updated.rateLimit,
    });
  } catch (error) {
    return handleApiError(error, "webmaster/api-keys/patch");
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

    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: { id: true, name: true, keyPrefix: true },
    });
    if (!existing) {
      return apiError("NOT_FOUND", "Clé API introuvable");
    }

    await prisma.apiKey.delete({ where: { id } });

    await writeAuditLog({
      actorId: admin.userId,
      action: "apikey.delete",
      target: "ApiKey",
      targetId: id,
      details: { name: existing.name, keyPrefix: existing.keyPrefix },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/api-keys/delete");
  }
}
