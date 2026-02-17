// src/lib/check-feature.ts — Plan feature check helper
import prisma from "@/lib/prisma";
import type { SubscriptionPlan } from "@prisma/client";

/**
 * Vérifie si une feature est activée pour un plan donné.
 * Retourne true si la feature existe et est enabled, false sinon.
 */
export async function hasFeature(
  plan: SubscriptionPlan,
  featureKey: string
): Promise<boolean> {
  const feature = await prisma.planFeature.findUnique({
    where: { plan_featureKey: { plan, featureKey } },
    select: { enabled: true },
  });
  return feature?.enabled ?? false;
}

/**
 * Retourne toutes les features activées pour un plan.
 */
export async function getEnabledFeatures(
  plan: SubscriptionPlan
): Promise<string[]> {
  const features = await prisma.planFeature.findMany({
    where: { plan, enabled: true },
    select: { featureKey: true },
  });
  return features.map((f) => f.featureKey);
}
