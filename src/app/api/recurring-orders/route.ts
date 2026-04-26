// POST /api/recurring-orders — Create a recurring order
// GET  /api/recurring-orders — List user's recurring orders
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VALID_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

const createRecurringSchema = z.object({
  orderId: z.string().min(1),
  frequency: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
});

const deleteRecurringSchema = z.object({
  id: z.string().min(1),
});
type Frequency = (typeof VALID_FREQUENCIES)[number];

function getNextRunDate(frequency: Frequency, dayOfWeek: number): Date {
  const now = new Date();
  const target = new Date(now);

  // Find next occurrence of the target day
  const currentDay = now.getDay(); // 0=Sun, 1=Mon...
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  if (frequency === "BIWEEKLY") {
    daysUntil += 7; // Start in 2 weeks
  } else if (frequency === "MONTHLY") {
    target.setMonth(target.getMonth() + 1);
    // Adjust to the right day of week
    const diff = dayOfWeek - target.getDay();
    target.setDate(target.getDate() + (diff >= 0 ? diff : diff + 7));
    target.setHours(8, 0, 0, 0);
    return target;
  }

  target.setDate(target.getDate() + daysUntil);
  target.setHours(8, 0, 0, 0);
  return target;
}

export async function GET() {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const recurring = await prisma.recurringOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Enrich with shop names
    const shopIds = [...new Set(recurring.map((r) => r.shopId))];
    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true, slug: true },
    });
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    const enriched = recurring.map((r) => ({
      ...r,
      shop: shopMap.get(r.shopId) || null,
    }));

    return apiSuccess(enriched);
  } catch (error) {
    return handleApiError(error, "recurring-orders/GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const rl = await checkRateLimit(rateLimits.api, `recurring-create:${userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const parsed = createRecurringSchema.parse(await req.json());

    const freq = parsed.frequency.toUpperCase();
    if (!VALID_FREQUENCIES.includes(freq as Frequency)) {
      return apiError("VALIDATION_ERROR", "Fréquence invalide (WEEKLY, BIWEEKLY, MONTHLY)");
    }

    const orderId = parsed.orderId;
    const dow = parsed.dayOfWeek ?? 1; // Default Monday

    // Fetch original order
    const original = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!original) return apiError("NOT_FOUND", "Commande introuvable");
    if (original.userId !== user.id) return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");

    // Create items snapshot
    const itemsSnapshot = original.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      weightGrams: i.weightGrams,
      itemNote: i.itemNote,
    }));

    const normalizedFreq = freq as Frequency;
    const nextRunAt = getNextRunDate(normalizedFreq, dow);

    const recurring = await prisma.recurringOrder.create({
      data: {
        userId: user.id,
        shopId: original.shopId,
        itemsSnapshot,
        frequency: normalizedFreq,
        dayOfWeek: dow,
        nextRunAt,
        active: true,
      },
    });

    return apiSuccess(recurring, 201);
  } catch (error) {
    return handleApiError(error, "recurring-orders/POST");
  }
}

// DELETE — cancel a recurring order
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const rl = await checkRateLimit(rateLimits.api, `recurring-delete:${userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const { id } = deleteRecurringSchema.parse(await req.json());

    const existing = await prisma.recurringOrder.findUnique({ where: { id } });
    if (!existing) return apiError("NOT_FOUND", "Récurrence introuvable");
    if (existing.userId !== user.id) return apiError("FORBIDDEN", "Accès refusé");

    await prisma.recurringOrder.update({
      where: { id },
      data: { active: false },
    });

    return apiSuccess({ cancelled: true });
  } catch (error) {
    return handleApiError(error, "recurring-orders/DELETE");
  }
}
