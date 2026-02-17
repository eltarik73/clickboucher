// GET  /api/boucher/subscription — Get current subscription info
// PATCH /api/boucher/subscription — Upgrade plan / change billing cycle
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const sub = await prisma.subscription.findUnique({
      where: { shopId: shop.id },
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
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const { plan, billingCycle } = await req.json();

    if (!["STARTER", "PRO", "PREMIUM"].includes(plan)) {
      return apiError("VALIDATION_ERROR", "Plan invalide");
    }

    if (billingCycle && !["monthly", "yearly"].includes(billingCycle)) {
      return apiError("VALIDATION_ERROR", "Cycle de facturation invalide");
    }

    const sub = await prisma.subscription.upsert({
      where: { shopId: shop.id },
      create: {
        shopId: shop.id,
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
