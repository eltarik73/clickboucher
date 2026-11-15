// src/lib/services/shops/moderation.ts — the platform's decisions on a shop: approve, publish,
// unpublish, suspend, reactivate. The ONLY writer of Shop.suspendedAt, suspendReason and
// validatedAt, and of Shop.visible on the admin side (the owner's vacation is the other writer of
// visible: src/lib/shop-vacation.ts). Called by the admin routes only, which keep the audit log.
//
// Each decision is a conditional write: the UPDATE carries the state the decision starts from,
// so two concurrent admin requests cannot both apply it (PostgreSQL re-checks the WHERE clause of
// the second after the first commits). The ShopLog row is written in the same transaction, only
// by the request whose write changed the row; the caches are dropped after the commit.
//
// Invariant kept here as in shop-vacation.ts: a shop is never listed (visible) while on vacation,
// so nothing the admin does lists a shop on vacation; its end of vacation lists it.
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { invalidateCachedShop } from "@/lib/cache/shop-cache";
import { redis } from "@/lib/redis";
import { SHOP_SUSPENDED_ADMIN_MESSAGE } from "@/lib/shop-publication";

export type ModerationResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT"; message: string };

type Refusal = Extract<ModerationResult, { ok: false }>;
/** Result of the transaction: the slug of the shop page to drop from the cache, or the refusal. */
type Outcome = { ok: true; slug: string } | Refusal;
type Tx = Prisma.TransactionClient;
type DecisionLog = { action: string; details?: string };

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;
const NOT_FOUND: Refusal = { ok: false, code: "NOT_FOUND", message: "Boutique introuvable" };
const ON_VACATION_ADMIN_MESSAGE =
  "Boutique en vacances : elle sera remise en ligne à la fin des vacances";

const NO_VACATION = {
  vacationMode: false,
  vacationStart: null,
  vacationEnd: null,
  vacationMessage: null,
} as const satisfies Prisma.ShopUpdateManyMutationInput;

/**
 * A suspended shop is unlisted and closed, and nothing is left that could reopen it: no pause,
 * busy period or vacation whose end would put it back online. The reason stays internal:
 * closedMessage, which the owner writes and customers may read, is not touched.
 */
const SUSPENDED_STATE = {
  visible: false,
  status: "CLOSED",
  paused: false,
  pausedAt: null,
  pauseEndsAt: null,
  pauseReason: null,
  autoPaused: false,
  autoPausedAt: null,
  busyMode: false,
  busyModeEndsAt: null,
  ...NO_VACATION,
} as const satisfies Prisma.ShopUpdateManyMutationInput;

type Write = {
  /** The state the write starts from, besides the shop id. */
  from: Prisma.ShopWhereInput;
  data: Prisma.ShopUpdateManyMutationInput;
};

type Decision = {
  /** Tried in order: the first whose starting state matches is applied, the next ones are not. */
  writes: readonly [Write, ...Write[]];
  log: DecisionLog;
  /** Answer when the shop exists but matches none of the starting states. */
  conflict: (shop: { suspendedAt: Date | null }) => string;
};

/** Writes the ShopLog row of a decision that changed the shop; returns the slug of its page. */
async function recordDecision(tx: Tx, shopId: string, log: DecisionLog): Promise<Outcome> {
  await tx.shopLog.create({ data: { shopId, ...log, triggeredBy: "admin" } });
  const { slug } = await tx.shop.findUniqueOrThrow({
    where: { id: shopId },
    select: { slug: true },
  });
  return { ok: true, slug };
}

/** After the commit: the cached status and the cached shop page show the decision at once. */
async function settle(shopId: string, outcome: Outcome): Promise<ModerationResult> {
  if (!outcome.ok) return outcome;
  await redis.del(`shop:status:${shopId}`);
  await invalidateCachedShop(outcome.slug);
  return { ok: true };
}

async function decide(shopId: string, decision: Decision): Promise<ModerationResult> {
  const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
    for (const write of decision.writes) {
      const { count } = await tx.shop.updateMany({
        where: { ...write.from, id: shopId },
        data: write.data,
      });
      if (count === 1) return recordDecision(tx, shopId, decision.log);
    }
    const shop = await tx.shop.findUnique({
      where: { id: shopId },
      select: { suspendedAt: true },
    });
    return shop ? { ok: false, code: "CONFLICT", message: decision.conflict(shop) } : NOT_FOUND;
  }, TRANSACTION_OPTIONS);
  return settle(shopId, outcome);
}

export function suspendShop(shopId: string, reason: string): Promise<ModerationResult> {
  return decide(shopId, {
    writes: [
      {
        from: { suspendedAt: null },
        data: { ...SUSPENDED_STATE, suspendedAt: new Date(), suspendReason: reason },
      },
    ],
    log: { action: "SUSPENDED", details: reason },
    conflict: () => "La boutique est déjà suspendue",
  });
}

/** Lifting a suspension is the admin's decision to put the shop back online and open. */
export function reactivateShop(shopId: string): Promise<ModerationResult> {
  return decide(shopId, {
    writes: [
      {
        from: { suspendedAt: { not: null } },
        data: { suspendedAt: null, suspendReason: null, visible: true, status: "OPEN" },
      },
    ],
    log: { action: "REACTIVATED" },
    conflict: () => "La boutique n'est pas suspendue",
  });
}

/**
 * Validates a shop and lists it. A shop on vacation is validated but stays unlisted: the end of its
 * vacation lists it. Only a suspension conflicts.
 */
export function approveShop(shopId: string): Promise<ModerationResult> {
  const validatedAt = new Date();
  return decide(shopId, {
    writes: [
      {
        from: { suspendedAt: null, vacationMode: false },
        data: { visible: true, onboardingCompleted: true, validatedAt },
      },
      {
        from: { suspendedAt: null, vacationMode: true },
        data: { onboardingCompleted: true, validatedAt },
      },
    ],
    log: { action: "APPROVED" },
    conflict: () => SHOP_SUSPENDED_ADMIN_MESSAGE,
  });
}

/**
 * Lists or unlists a shop. Listing refuses a suspended shop and a shop on vacation (the end of its
 * vacation lists it). Unlisting also cancels a vacation in progress, whose end would list the shop
 * again; it has no starting condition, so it never conflicts.
 */
export async function setShopPublished(
  shopId: string,
  published: boolean
): Promise<ModerationResult> {
  if (published) {
    return decide(shopId, {
      writes: [{ from: { suspendedAt: null, vacationMode: false }, data: { visible: true } }],
      log: { action: "PUBLISHED" },
      conflict: (shop) =>
        shop.suspendedAt ? SHOP_SUSPENDED_ADMIN_MESSAGE : ON_VACATION_ADMIN_MESSAGE,
    });
  }
  const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
    await tx.shop.updateMany({
      where: { id: shopId, vacationMode: true },
      data: { ...NO_VACATION, status: "CLOSED" },
    });
    const { count } = await tx.shop.updateMany({ where: { id: shopId }, data: { visible: false } });
    return count === 1 ? recordDecision(tx, shopId, { action: "UNPUBLISHED" }) : NOT_FOUND;
  }, TRANSACTION_OPTIONS);
  return settle(shopId, outcome);
}
