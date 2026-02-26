// GET /api/auth/me — Return current user's DB record (role, id)
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true, firstName: true, lastName: true },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
