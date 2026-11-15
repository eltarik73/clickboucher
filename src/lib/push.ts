// src/lib/push.ts — Web Push notifications (graceful fallback if VAPID not configured)
import webpush from "web-push";
import { logger } from "@/lib/logger";

let configured = false;

/** Les trois variables VAPID sont présentes et acceptées par web-push. */
export function isPushConfigured(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    return false;
  }

  try {
    webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
    configured = true;
    return true;
  } catch (error) {
    console.error("[push] VAPID config error:", (error as Error).message);
    return false;
  }
}

export type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  actions?: { action: string; title: string }[];
};

/**
 * false : envoi en échec (abonnement expiré ou autre erreur), et l'appelant efface l'abonnement.
 * Sans clés VAPID rien ne part mais la réponse reste true pour ne rien effacer : l'appelant
 * consulte isPushConfigured() avant d'envoyer.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured()) {
    logger.warn("[push] VAPID non configuré : notification non envoyée");
    return true;
  }

  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    // 410 Gone = subscription expired, caller should clean up
    if (err.statusCode === 410) {
      console.warn("[push] Subscription expired (410)");
      return false;
    }
    console.error("[push] Send failed:", err.message);
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
