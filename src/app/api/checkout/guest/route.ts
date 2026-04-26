export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError, formatZodError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { createOrder } from "@/lib/services/orders/create";
import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-auth";
import { logger } from "@/lib/logger";

// ── Validator ──────────────────────────────────────
// Light schema for the guest-only fields. The full order payload (items,
// shopId, slots, ...) is validated downstream by createOrder().
const guestCheckoutSchema = z.object({
  email: z.string().email("Email invalide").max(200),
  phone: z
    .string()
    .trim()
    .min(6, "Téléphone trop court")
    .max(30, "Téléphone trop long")
    .optional()
    .or(z.literal("")),
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
});

// ── POST /api/checkout/guest ───────────────────────
// Anonymous checkout — creates a shadow Prisma User (clerkId=null) and
// the order in one go. Returns the created order + sets an httpOnly
// cookie carrying a guestToken used to access /suivi/[id]?guestToken=...
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const guestParse = guestCheckoutSchema.safeParse({
      email: body.email,
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
    });
    if (!guestParse.success) {
      return apiError("VALIDATION_ERROR", "Donnees invalides", formatZodError(guestParse.error));
    }
    const guest = guestParse.data;

    // Rate limit on email — abuse protection (no userId yet)
    const rl = await checkRateLimit(rateLimits.orders, `guest:${guest.email.toLowerCase()}`);
    if (!rl.success) {
      return apiError("CAPACITY_EXCEEDED", "Trop de commandes, veuillez patienter");
    }

    const emailLc = guest.email.toLowerCase();

    // Find or create the shadow user. If a real (Clerk) account already
    // exists with this email, refuse — they should sign in instead.
    let user = await prisma.user.findUnique({ where: { email: emailLc } });
    if (user && user.clerkId) {
      return apiError(
        "CONFLICT",
        "Un compte existe déjà avec cet email. Connectez-vous pour commander."
      );
    }

    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            email: emailLc,
            firstName: guest.firstName,
            lastName: guest.lastName,
            phone: guest.phone || null,
            role: "CLIENT",
            isGuest: true,
            guestToken: randomUUID(),
          },
        });
      } catch (err) {
        logger.error("[checkout/guest] failed to create shadow user", { err });
        return apiError("INTERNAL_ERROR", "Impossible de créer le compte invité");
      }
    } else {
      // Existing guest user — refresh phone/name if missing, ensure guestToken set.
      const updates: Record<string, unknown> = {};
      if (!user.guestToken) updates.guestToken = randomUUID();
      if (!user.phone && guest.phone) updates.phone = guest.phone;
      if (!user.firstName && guest.firstName) updates.firstName = guest.firstName;
      if (!user.lastName && guest.lastName) updates.lastName = guest.lastName;
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      }
    }

    if (!user.guestToken) {
      // Defensive — should never happen.
      return apiError("INTERNAL_ERROR", "Token invité manquant");
    }

    const result = await createOrder(body, {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      clerkId: user.clerkId,
    });

    if (!result.ok) {
      return apiError(
        result.code,
        result.message,
        result.details as Record<string, string[]> | undefined
      );
    }

    const response = apiSuccess(
      {
        order: result.order,
        guestToken: user.guestToken,
      },
      result.status
    );

    // Set httpOnly cookie so the user can access /suivi/[id] without query token.
    response.cookies.set(GUEST_COOKIE_NAME, user.guestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
