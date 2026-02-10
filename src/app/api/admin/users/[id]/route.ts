import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api/errors";

const ROLE_MAP: Record<string, string> = {
  client: "CLIENT",
  client_pro: "CLIENT_PRO",
  client_pro_pending: "CLIENT_PRO_PENDING",
  boucher: "BOUCHER",
  admin: "ADMIN",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { sessionClaims } = await auth();
    const callerRole = (sessionClaims?.metadata as Record<string, string>)?.role;
    if (callerRole !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await req.json();
    const newRole = body.role as string;

    if (!newRole || !ROLE_MAP[newRole]) {
      return NextResponse.json(
        { error: "Rôle invalide. Valeurs acceptées : " + Object.keys(ROLE_MAP).join(", ") },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, clerkId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const prismaRole = ROLE_MAP[newRole] as "CLIENT" | "CLIENT_PRO" | "CLIENT_PRO_PENDING" | "BOUCHER" | "ADMIN";

    // Update DB
    await prisma.user.update({
      where: { id },
      data: {
        role: prismaRole,
        ...(prismaRole === "CLIENT_PRO"
          ? { proStatus: "APPROVED", proValidatedAt: new Date() }
          : {}),
        ...(prismaRole === "CLIENT"
          ? { proStatus: null, proValidatedAt: null, proValidatedBy: null }
          : {}),
      },
    });

    // Update Clerk metadata
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(user.clerkId, {
      publicMetadata: { role: newRole },
    });

    return NextResponse.json({ success: true, role: prismaRole });
  } catch (error) {
    return handleApiError(error, "admin/users/patch");
  }
}
