// GET /api/auth/check-admin — Lightweight admin role check for tap-5x
// Audit sécurité CTO #2 2026-05-09 : retiré currentUser() Clerk
// (publicMetadata stale si webhook échoue) au profit de DB lookup direct.
// CLAUDE.md : "toujours faire un lookup DB pour les rôles".
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";
import { getServerUserId, isTestActivated, getTestRole } from "@/lib/auth/server-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getServerUserId();
    if (!userId) return NextResponse.json({ admin: false }, { status: 401 });

    // Test mode bypass
    if (isTestActivated() && getTestRole() === "ADMIN") {
      return NextResponse.json({ admin: true });
    }

    // Source of truth = DB (pas Clerk publicMetadata qui peut être stale)
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (isAdmin(dbUser?.role)) {
      return NextResponse.json({ admin: true });
    }

    return NextResponse.json({ admin: false }, { status: 403 });
  } catch (error) {
    logger.error("[auth/check-admin]", { error: (error as Error)?.message });
    return NextResponse.json({ admin: false }, { status: 500 });
  }
}
