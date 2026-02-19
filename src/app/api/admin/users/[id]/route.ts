import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
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

const patchUserSchema = z.object({
  role: z.enum(["client", "client_pro", "client_pro_pending", "boucher", "admin"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const adminCheck = await requireAdmin();
    if (adminCheck.error) return adminCheck.error;

    const body = await req.json();
    const parsed = patchUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Rôle invalide. Valeurs acceptées : " + Object.keys(ROLE_MAP).join(", "));
    }
    const newRole = parsed.data.role;

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
