// POST /api/push/subscribe — Store push subscription for authenticated user
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getVapidPublicKey } from "@/lib/push";

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

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return apiError("VALIDATION_ERROR", "Subscription invalide");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pushSubscription: {
          endpoint: body.endpoint,
          keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
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
