// POST /api/push/subscribe — Store push subscription for authenticated user
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getVapidPublicKey } from "@/lib/push";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const dynamic = "force-dynamic";

// GET — return VAPID public key so client can subscribe
export async function GET() {
  const key = getVapidPublicKey();
  return apiSuccess({ vapidPublicKey: key });
}

// POST — store the push subscription
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const body = await req.json();
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Subscription invalide : endpoint et keys (p256dh, auth) requis");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pushSubscription: {
          endpoint: parsed.data.endpoint,
          keys: { p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
        },
        notifPush: true,
      },
    });

    return apiSuccess({ subscribed: true });
  } catch (error) {
    return handleApiError(error, "push/subscribe");
  }
}

// DELETE — remove push subscription
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pushSubscription: Prisma.DbNull },
    });

    return apiSuccess({ unsubscribed: true });
  } catch (error) {
    return handleApiError(error, "push/unsubscribe");
  }
}
