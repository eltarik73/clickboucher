// src/lib/marketing/segments.ts — Client segment logic
import prisma from "@/lib/prisma";
import type { OfferAudience } from "@prisma/client";

export type ClientSegment = "NEW" | "REGULAR" | "LOYAL" | "VIP";

/**
 * Determine a client's segment based on completed order count
 */
export async function getClientSegment(userId: string): Promise<ClientSegment> {
  const count = await prisma.order.count({
    where: { userId, status: { in: ["COMPLETED", "PICKED_UP"] } },
  });
  if (count === 0) return "NEW";
  if (count < 5) return "REGULAR";
  if (count < 10) return "LOYAL";
  return "VIP";
}

/**
 * Check if a client segment is eligible for an offer audience
 */
export function isSegmentEligible(segment: ClientSegment, audience: OfferAudience): boolean {
  switch (audience) {
    case "ALL":
      return true;
    case "NEW":
      return segment === "NEW";
    case "LOYAL":
      return segment === "LOYAL" || segment === "VIP";
    case "VIP":
      return segment === "VIP";
    default:
      return false;
  }
}
