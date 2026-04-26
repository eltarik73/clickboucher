// GET /api/webmaster/staff — List all admin/webmaster staff with activity stats
// POST /api/webmaster/staff — Promote an existing user to ADMIN
import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    // All admin users in DB
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Get audit counts per admin (actions performed)
    // Admins are always Clerk-registered, but the Prisma type is now nullable
    // (because of guest checkout). Filter null values defensively.
    const adminClerkIds = admins.map((a) => a.clerkId).filter((c): c is string => c !== null);

    const auditCounts = await prisma.auditLog.groupBy({
      by: ["actorId"],
      where: { actorId: { in: adminClerkIds } },
      _count: true,
    });
    const auditMap = Object.fromEntries(
      auditCounts.map((a) => [a.actorId, a._count])
    );

    // Last activity per admin — single query with ordering (instead of N findFirst)
    const allAdminLogs = adminClerkIds.length > 0
      ? await prisma.auditLog.findMany({
          where: { actorId: { in: adminClerkIds } },
          orderBy: { createdAt: "desc" },
          select: { actorId: true, action: true, createdAt: true },
          take: 1000,
        })
      : [];
    const lastActivityMap: Record<string, { action: string; createdAt: Date } | null> = {};
    for (const log of allAdminLogs) {
      if (!lastActivityMap[log.actorId]) {
        lastActivityMap[log.actorId] = { action: log.action, createdAt: log.createdAt };
      }
    }
    for (const clerkId of adminClerkIds) {
      if (!lastActivityMap[clerkId]) lastActivityMap[clerkId] = null;
    }

    // Recent global audit entries (last 20)
    const recentAudit = await prisma.auditLog.findMany({
      where: { actorId: { in: adminClerkIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        actorId: true,
        action: true,
        target: true,
        targetId: true,
        createdAt: true,
      },
    });

    // Map admin names for audit (skip admins without clerkId — defensive)
    const nameMap = Object.fromEntries(
      admins
        .filter((a): a is typeof a & { clerkId: string } => a.clerkId !== null)
        .map((a) => [a.clerkId, `${a.firstName} ${a.lastName}`])
    );

    return apiSuccess({
      staff: admins.map((a) => ({
        id: a.id,
        clerkId: a.clerkId,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        createdAt: a.createdAt,
        auditCount: a.clerkId ? auditMap[a.clerkId] || 0 : 0,
        lastActivity: a.clerkId ? lastActivityMap[a.clerkId] || null : null,
      })),
      totalAdmins: admins.length,
      recentAudit: recentAudit.map((a) => ({
        ...a,
        actorName: nameMap[a.actorId] || a.actorId,
      })),
    });
  } catch (error) {
    return handleApiError(error, "webmaster/staff");
  }
}

// POST — Promote an existing user to ADMIN by email
const promoteSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const parsed = promoteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Email invalide");
    }

    const { email } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, clerkId: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Aucun utilisateur trouvé avec cet email. L'utilisateur doit d'abord créer un compte.");
    }

    if (user.role === "ADMIN") {
      return apiError("CONFLICT", "Cet utilisateur est déjà administrateur");
    }

    if (!user.clerkId) {
      return apiError("CONFLICT", "Cet utilisateur n'a pas de compte Clerk (invité)");
    }

    // Update DB
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    // Update Clerk metadata
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(user.clerkId, {
      publicMetadata: { role: "admin" },
    });

    await writeAuditLog({
      actorId: admin.userId,
      action: "staff.promote",
      target: "User",
      targetId: user.id,
      details: { email: user.email, previousRole: user.role },
    });

    return apiSuccess({
      promoted: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    return handleApiError(error, "webmaster/staff/promote");
  }
}
