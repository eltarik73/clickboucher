// PATCH /api/webmaster/staff/[userId] — Revoke admin access (demote to CLIENT)
import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { userId } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, clerkId: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    if (user.role !== "ADMIN") {
      return apiError("CONFLICT", "Cet utilisateur n'est pas administrateur");
    }

    // Prevent self-demotion
    if (user.clerkId === admin.userId) {
      return apiError("FORBIDDEN", "Vous ne pouvez pas révoquer votre propre accès admin");
    }

    // Check we're not removing the last admin
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return apiError("FORBIDDEN", "Impossible de retirer le dernier administrateur");
    }

    // Demote to CLIENT
    await prisma.user.update({
      where: { id: userId },
      data: { role: "CLIENT" },
    });

    if (user.clerkId) {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: "client" },
      });
    }

    await writeAuditLog({
      actorId: admin.userId,
      action: "staff.revoke",
      target: "User",
      targetId: user.id,
      details: { email: user.email },
    });

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleApiError(error, "webmaster/staff/revoke");
  }
}
