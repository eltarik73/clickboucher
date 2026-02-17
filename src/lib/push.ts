// src/lib/push.ts — Web Push notifications (graceful fallback if VAPID not configured)
import webpush from "web-push";

let configured = false;

function ensureConfig(): boolean {
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

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: { title: string; body: string; icon?: string; url?: string }
): Promise<boolean> {
  if (!ensureConfig()) {
    console.log(`🔔 PUSH (stub) → ${payload.title}: ${payload.body}`);
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
