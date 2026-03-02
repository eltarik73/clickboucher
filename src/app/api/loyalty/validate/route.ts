// POST /api/loyalty/validate — Validate a loyalty reward code
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { validateLoyaltyCode } from "@/lib/services/loyalty.service";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(1),
  orderTotalCents: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Resolve Prisma user.id from clerkId
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const body = await req.json();
    const { code, orderTotalCents } = schema.parse(body);

    const result = await validateLoyaltyCode(code.toUpperCase().trim(), dbUser.id, orderTotalCents);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "loyalty/validate/POST");
  }
}
