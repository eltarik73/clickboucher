import { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { z } from "zod";

export const dynamic = "force-dynamic";

const upgradeProSchema = z.object({
  companyName: z.string().min(2, "Nom d'entreprise requis").max(200),
  siret: z.string().regex(/^[0-9]{14}$/, "SIRET invalide (14 chiffres)"),
  sector: z.string().min(1, "Secteur requis"),
  phone: z
    .string()
    .regex(/^\+33[0-9]{9}$/, "Numéro au format +33XXXXXXXXX")
    .optional(),
});

// ── POST /api/users/upgrade-pro ──────────────────
// Client → request pro upgrade
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Verify user exists and is CLIENT (auto-create if webhook hasn't fired)
    const user = await getOrCreateUser(userId);

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    if (user.role === "CLIENT_PRO") {
      return apiError("CONFLICT", "Vous êtes déjà un client professionnel");
    }

    if (user.role === "CLIENT_PRO_PENDING") {
      return apiError("CONFLICT", "Une demande est déjà en cours de validation");
    }

    if (user.role !== "CLIENT") {
      return apiError("FORBIDDEN", "Seuls les clients peuvent demander le statut pro");
    }

    const body = await req.json();
    const data = upgradeProSchema.parse(body);

    // Update user in DB
    const updated = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        companyName: data.companyName,
        siret: data.siret,
        sector: data.sector,
        role: "CLIENT_PRO_PENDING",
        proStatus: "PENDING",
        ...(data.phone && { phone: data.phone }),
      },
    });

    // Update Clerk public metadata
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: "client_pro_pending" },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
