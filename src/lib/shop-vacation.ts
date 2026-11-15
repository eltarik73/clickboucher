// src/lib/shop-vacation.ts — the owner's vacation (Deliveroo « vacation mode »), re-exported by
// src/lib/shop-status.ts.
//
// Only a listed shop goes on vacation, and it is unlisted meanwhile: vacationMode = true therefore
// means « was listed », and ending a vacation lists the shop again. Every write is conditional, so
// it cannot list a shop that never was (never validated, unpublished by the admin) nor touch a
// suspended one: a suspension is lifted by the admin only (src/lib/services/shops/moderation.ts).
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { redis } from "./redis";

export type VacationChange =
  | { ok: true }
  | { ok: false; reason: "SUSPENDED" | "NOT_PUBLISHED" | "NOT_ON_VACATION" };

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

/** The end of a vacation, whoever ends it: the owner, the lazy expiry or the cron. */
const VACATION_END = {
  status: "OPEN",
  vacationMode: false,
  vacationStart: null,
  vacationEnd: null,
  vacationMessage: null,
  visible: true,
} as const satisfies Prisma.ShopUpdateManyMutationInput;

/** The conditional write matched no row: a suspended shop says so, any other gets `otherwise`. */
async function refusal(
  tx: Tx,
  shopId: string,
  otherwise: "NOT_PUBLISHED" | "NOT_ON_VACATION"
): Promise<VacationChange> {
  const shop = await tx.shop.findUnique({ where: { id: shopId }, select: { suspendedAt: true } });
  return { ok: false, reason: shop?.suspendedAt ? "SUSPENDED" : otherwise };
}

/** Starts or reschedules the vacation of a listed (or already on vacation), non-suspended shop. */
export async function setVacationMode(
  shopId: string,
  options: { start: Date; end: Date; message?: string }
): Promise<VacationChange> {
  const change = await prisma.$transaction(async (tx): Promise<VacationChange> => {
    const { count } = await tx.shop.updateMany({
      where: { id: shopId, suspendedAt: null, OR: [{ visible: true }, { vacationMode: true }] },
      data: {
        status: "VACATION",
        vacationMode: true,
        vacationStart: options.start,
        vacationEnd: options.end,
        vacationMessage: options.message || "Nous sommes en vacances, à bientôt !",
        visible: false,
      },
    });
    if (count === 0) return refusal(tx, shopId, "NOT_PUBLISHED");
    await tx.shopLog.create({
      data: {
        shopId,
        action: "VACATION_ON",
        details: `Du ${options.start.toISOString()} au ${options.end.toISOString()}`,
        triggeredBy: "boucher",
      },
    });
    return { ok: true };
  }, TRANSACTION_OPTIONS);
  if (change.ok) await redis.del(`shop:status:${shopId}`);
  return change;
}

/** Ends the vacation of a non-suspended shop that is on vacation: listed and open again. */
export async function endVacationMode(
  shopId: string,
  triggeredBy: "boucher" | "system" = "boucher"
): Promise<VacationChange> {
  const change = await prisma.$transaction(async (tx): Promise<VacationChange> => {
    const { count } = await tx.shop.updateMany({
      where: { id: shopId, vacationMode: true, suspendedAt: null },
      data: VACATION_END,
    });
    if (count === 0) return refusal(tx, shopId, "NOT_ON_VACATION");
    await tx.shopLog.create({ data: { shopId, action: "VACATION_OFF", triggeredBy } });
    return { ok: true };
  }, TRANSACTION_OPTIONS);
  if (change.ok) await redis.del(`shop:status:${shopId}`);
  return change;
}

/** Ends, in one write, every vacation over at `now` of a non-suspended shop; returns how many. */
export async function endExpiredVacations(now: Date): Promise<number> {
  const { count } = await prisma.shop.updateMany({
    where: { vacationMode: true, vacationEnd: { not: null, lte: now }, suspendedAt: null },
    data: VACATION_END,
  });
  return count;
}
