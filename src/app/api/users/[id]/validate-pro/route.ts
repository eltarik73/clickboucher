import { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { z } from "zod";

const validateProSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

// ── POST /api/users/[id]/validate-pro ────────
// Boucher or Admin — approve or reject a pro request
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    if (role !== "boucher" && role !== "admin") {
      return apiError("FORBIDDEN", "Acces reserve aux bouchers et admins");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, clerkId: true, role: true, proStatus: true },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    if (user.role !== "CLIENT_PRO_PENDING") {
      return apiError("VALIDATION_ERROR", "Cet utilisateur n'a pas de demande pro en attente");
    }

    const body = await req.json();
    const data = validateProSchema.parse(body);

    if (data.action === "approve") {
      // Update DB
      const updated = await prisma.user.update({
        where: { id },
        data: {
          role: "CLIENT_PRO",
          proStatus: "APPROVED",
          proValidatedBy: userId,
          proValidatedAt: new Date(),
        },
      });

      // Update Clerk metadata
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: "client_pro" },
      });

      await sendNotification("PRO_VALIDATED", { userId: user.clerkId });

      return apiSuccess(updated);
    } else {
      // Reject
      const updated = await prisma.user.update({
        where: { id },
        data: {
          proStatus: "REJECTED",
          role: "CLIENT",
        },
      });

      // Reset Clerk metadata
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: "client" },
      });

      await sendNotification("PRO_REJECTED", { userId: user.clerkId });

      return apiSuccess(updated);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
