// GET  /api/boucher/subscription — Get current subscription info
// PATCH /api/boucher/subscription — Upgrade plan / change billing cycle
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

const patchSubscriptionSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "PREMIUM"]),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const sub = await prisma.subscription.findUnique({
      where: { shopId },
    });

    if (!sub) {
      return apiSuccess({
        plan: "STARTER",
        status: "PENDING",
        billingCycle: "monthly",
        trialEndsAt: null,
        currentPeriodEnd: null,
        daysLeft: null,
      });
    }

    let daysLeft: number | null = null;
    if (sub.status === "TRIAL" && sub.trialEndsAt) {
      daysLeft = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    return apiSuccess({
      plan: sub.plan,
      status: sub.status,
      billingCycle: sub.billingCycle,
      trialEndsAt: sub.trialEndsAt?.toISOString() || null,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      daysLeft,
    });
  } catch (error) {
    return handleApiError(error, "boucher/subscription/GET");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const parsed = patchSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Données invalides");
    }
    const { plan, billingCycle } = parsed.data;

    const sub = await prisma.subscription.upsert({
      where: { shopId },
      create: {
        shopId,
        plan,
        status: "ACTIVE",
        billingCycle: billingCycle || "monthly",
        yearlyDiscount: billingCycle === "yearly",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000),
      },
      update: {
        plan,
        billingCycle: billingCycle || "monthly",
        yearlyDiscount: billingCycle === "yearly",
      },
    });

    let daysLeft: number | null = null;
    if (sub.status === "TRIAL" && sub.trialEndsAt) {
      daysLeft = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    return apiSuccess({
      plan: sub.plan,
      status: sub.status,
      billingCycle: sub.billingCycle,
      trialEndsAt: sub.trialEndsAt?.toISOString() || null,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      daysLeft,
    });
  } catch (error) {
    return handleApiError(error, "boucher/subscription/PATCH");
  }
}
