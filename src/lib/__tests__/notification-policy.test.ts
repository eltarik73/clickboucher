// @vitest-environment node
import { describe, expect, it } from "vitest";
import { notificationThrottle, type NotificationThrottle } from "@/lib/notification-policy";
import type { NotifEvent } from "@/lib/notifications";

// Record<NotifEvent, …> : le typage impose que chaque événement figure dans cette table.
const EXPECTED: Record<NotifEvent, NotificationThrottle> = {
  ORDER_PENDING: "none",
  ORDER_ACCEPTED: "none",
  ORDER_PREPARING: "none",
  ORDER_DENIED: "none",
  ORDER_READY: "none",
  ORDER_PICKED_UP: "none",
  ORDER_CANCELLED: "none",
  ORDER_CANCELLED_BY_CUSTOMER: "none",
  ORDER_EXPIRED: "none",
  BOUCHER_NOTE: "none",
  READY_REMINDER: "none",
  STOCK_ISSUE: "none",
  PRO_VALIDATED: "none",
  PRO_REJECTED: "none",
  SCHEDULED_REMINDER: "none",
  ACCOUNT_APPROVED: "none",
  PRICE_ADJUSTMENT_PENDING: "none",
  PRICE_ADJUSTMENT_AUTO_APPROVED: "none",
  PRICE_ADJUSTMENT_ACCEPTED: "none",
  PRICE_ADJUSTMENT_REJECTED: "none",
  PRICE_ADJUSTMENT_AUTO_VALIDATED: "none",
  PRICE_ADJUSTMENT_ESCALATED: "none",
  PICKUP_SOON: "none",
  CART_ABANDONED: "hourly-per-type",
  PROMO_NEW: "hourly-per-type",
  FLASH_OFFER: "hourly-per-type",
  LOYALTY_REWARD_EARNED: "hourly-per-type",
  RECURRING_REMINDER: "hourly-per-type",
  CALENDAR_ALERT: "hourly-per-type",
  WEEKLY_REPORT: "hourly-per-type",
};

const events = Object.keys(EXPECTED) as NotifEvent[];

describe("notificationThrottle", () => {
  it.each(events)("%s", (event) => {
    expect(notificationThrottle(event)).toBe(EXPECTED[event]);
  });

  it("never throttles a transactional order event", () => {
    const transactional = events.filter(
      (event) =>
        event.startsWith("ORDER_") ||
        event.startsWith("PRICE_ADJUSTMENT_") ||
        event.startsWith("PRO_")
    );
    expect(transactional.length).toBeGreaterThan(15);
    for (const event of transactional) {
      expect(notificationThrottle(event)).toBe("none");
    }
  });

  it("throttles exactly the seven marketing and digest events", () => {
    expect(events.filter((event) => notificationThrottle(event) === "hourly-per-type")).toEqual([
      "CART_ABANDONED",
      "PROMO_NEW",
      "FLASH_OFFER",
      "LOYALTY_REWARD_EARNED",
      "RECURRING_REMINDER",
      "CALENDAR_ALERT",
      "WEEKLY_REPORT",
    ]);
  });
});
