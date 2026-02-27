// GET /api/auth/check-admin — Lightweight admin role check for tap-5x
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getServerUserId, isTestActivated, getTestRole } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getServerUserId();
    if (!userId) return NextResponse.json({ admin: false }, { status: 401 });

    // Test mode bypass
    if (isTestActivated() && getTestRole() === "ADMIN") {
      return NextResponse.json({ admin: true });
    }

    // Check Clerk metadata first
    const user = await currentUser();
    const role = (user?.publicMetadata as Record<string, string>)?.role;
    if (isAdmin(role)) {
      return NextResponse.json({ admin: true });
    }

    // Fallback: check DB
    const dbUser = await prisma.user.findFirst({
      where: { clerkId: userId, role: "ADMIN" },
      select: { id: true },
    });

    if (dbUser) {
      return NextResponse.json({ admin: true });
    }

    return NextResponse.json({ admin: false }, { status: 403 });
  } catch {
    return NextResponse.json({ admin: false }, { status: 500 });
  }
}
