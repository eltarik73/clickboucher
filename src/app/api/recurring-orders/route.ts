// POST /api/recurring-orders — Create a recurring order
// GET  /api/recurring-orders — List user's recurring orders
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

const VALID_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
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
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const recurring = await prisma.recurringOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
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
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const { orderId, frequency, dayOfWeek } = await req.json();

    if (!orderId || !frequency) {
      return apiError("VALIDATION_ERROR", "orderId et frequency requis");
    }

    const freq = frequency.toUpperCase();
    if (!VALID_FREQUENCIES.includes(freq as Frequency)) {
      return apiError("VALIDATION_ERROR", "Fréquence invalide (WEEKLY, BIWEEKLY, MONTHLY)");
    }

    const dow = typeof dayOfWeek === "number" ? dayOfWeek : 1; // Default Monday
    if (dow < 0 || dow > 6) {
      return apiError("VALIDATION_ERROR", "Jour de la semaine invalide (0-6)");
    }

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
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const { id } = await req.json();
    if (!id) return apiError("VALIDATION_ERROR", "id requis");

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
