export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { Prisma, User } from "@prisma/client";

import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError, formatZodError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { createOrder } from "@/lib/services/orders/create";
import { customerOrderById } from "@/lib/services/orders/customer-view";
import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-auth";
import { uniqueViolationFields } from "@/lib/prisma-errors";

// ── Validator ──────────────────────────────────────
// The body carries the guest identity beside the order fields. Only the order
// fields reach createOrder(), whose strict schema validates them.
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

const EMAIL_COLUMN = "email";

/**
 * The user row of this e-mail: the shadow user (clerkId=null) created on the guest's first order,
 * or an existing row, Clerk account included (the caller refuses those). An existing guest row gets
 * its missing guestToken, phone or names filled in.
 */
async function guestUser(
  emailLc: string,
  guest: z.infer<typeof guestCheckoutSchema>
): Promise<User> {
  let user = await prisma.user.findUnique({ where: { email: emailLc } });
  if (!user) {
    try {
      return await prisma.user.create({
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
    } catch (error) {
      // Two first requests of the same new guest race on users.email: the loser reads the winner's
      // row and goes on, so its order is created or replayed by its idempotency key.
      if (!uniqueViolationFields(error)?.includes(EMAIL_COLUMN)) throw error;
      user = await prisma.user.findUniqueOrThrow({ where: { email: emailLc } });
    }
  }
  if (user.clerkId) return user;

  const updates: Prisma.UserUpdateInput = {};
  if (!user.guestToken) updates.guestToken = randomUUID();
  if (!user.phone && guest.phone) updates.phone = guest.phone;
  if (!user.firstName && guest.firstName) updates.firstName = guest.firstName;
  if (!user.lastName && guest.lastName) updates.lastName = guest.lastName;
  if (Object.keys(updates).length === 0) return user;
  return prisma.user.update({ where: { id: user.id }, data: updates });
}

// ── POST /api/checkout/guest ───────────────────────
// Anonymous checkout — creates a shadow Prisma User (clerkId=null) and
// the order in one go. Returns the created order + sets an httpOnly
// cookie carrying a guestToken used to access /suivi/[id]?guestToken=...
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return apiError("VALIDATION_ERROR", "Données invalides");
    }
    const { email, phone, firstName, lastName, ...orderFields } = body as Record<string, unknown>;

    const guestParse = guestCheckoutSchema.safeParse({ email, phone, firstName, lastName });
    if (!guestParse.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(guestParse.error));
    }
    const guest = guestParse.data;

    // Rate limit on email — abuse protection (no userId yet)
    const rl = await checkRateLimit(rateLimits.orders, `guest:${guest.email.toLowerCase()}`);
    if (!rl.success) {
      return apiError("CAPACITY_EXCEEDED", "Trop de commandes, veuillez patienter");
    }

    const emailLc = guest.email.toLowerCase();

    const user = await guestUser(emailLc, guest);
    if (user.clerkId) {
      return apiError(
        "CONFLICT",
        "Un compte existe déjà avec cet email. Connectez-vous pour commander."
      );
    }

    if (!user.guestToken) {
      // Defensive — should never happen.
      return apiError("INTERNAL_ERROR", "Token invité manquant");
    }

    const result = await createOrder(orderFields, {
      id: user.id,
      role: user.role,
      isGuest: true,
      firstName: user.firstName,
      email: user.email,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.details);
    }

    const response = apiSuccess(
      {
        order: await customerOrderById(result.order.id),
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
    return handleApiError(error, "checkout/guest POST");
  }
}
