// src/lib/push.ts — Web Push transport. Every send says what became of it, so that the caller
// records a channel only when a push left and deletes a subscription only when it is gone.
import webpush, { WebPushError } from "web-push";
import { logger } from "@/lib/logger";

/**
 * `expired`: the push service says the subscription no longer exists, delete it. `failed`: a
 * refusal or network error that says nothing about the subscription, keep it.
 */
export type PushResult = "sent" | "expired" | "failed" | "not_configured";

// Push services answer 404 or 410 for a subscription that no longer exists (RFC 8030 § 7.3).
const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

let configured = false;

/** The three VAPID variables are set and accepted by web-push. */
function isPushConfigured(): boolean {
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
    logger.error("[push] VAPID keys refused by web-push", error);
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

// Logs never carry the payload nor the endpoint: both identify the customer.
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<PushResult> {
  if (!isPushConfigured()) {
    logger.warn("[push] VAPID not configured: notification not sent");
    return "not_configured";
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return "sent";
  } catch (error) {
    if (!(error instanceof WebPushError)) {
      logger.error("[push] send failed", error);
      return "failed";
    }
    if (GONE_STATUSES.has(error.statusCode)) {
      logger.warn("[push] subscription gone", { statusCode: error.statusCode });
      return "expired";
    }
    logger.error("[push] push service refused the notification", {
      statusCode: error.statusCode,
    });
    return "failed";
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
