import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

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
    const adminCheck = await requireAdmin();
    if (adminCheck.error) return adminCheck.error;

    const body = await req.json();
    const newRole = body.role as string;

    if (!newRole || !ROLE_MAP[newRole]) {
      return apiError("VALIDATION_ERROR", "Rôle invalide. Valeurs acceptées : " + Object.keys(ROLE_MAP).join(", "));
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, clerkId: true },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
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

    return apiSuccess({ role: prismaRole });
  } catch (error) {
    return handleApiError(error, "admin/users/patch");
  }
}
