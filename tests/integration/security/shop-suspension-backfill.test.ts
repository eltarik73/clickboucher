// @vitest-environment node
// Owner-triggered data repair of C1-FAILLES-CRITIQUES: the shops suspended by the previous code
// (audit log 'shop.suspend', suspended_at never written) become suspended for the new code. The two
// SQL files are run as they are, on real PostgreSQL.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma, Shop } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { reactivateShop } from "@/lib/services/shops/moderation";
import { shopPublication } from "@/lib/shop-publication";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const MIGRATION_DIR = path.resolve(
  __dirname,
  "../../../prisma/migrations/20261115120000_c1_failles_critiques"
);
const DRY_RUN_SQL = readFileSync(
  path.join(MIGRATION_DIR, "backfill-after-release.dry-run.sql"),
  "utf8"
);
const BACKFILL_SQL = readFileSync(path.join(MIGRATION_DIR, "backfill-after-release.sql"), "utf8");

const LEGACY_CLOSED_MESSAGE = "Boutique suspendue par l'administration";
const GENERIC_REASON = "Suspendue par l'administration";
const at = (iso: string) => new Date(`2026-11-${iso}Z`);

async function audit(shop: Shop, action: string, createdAt: Date, details: Prisma.InputJsonObject) {
  await prisma.auditLog.create({
    data: { actorId: "admin_itest", action, target: "Shop", targetId: shop.id, details, createdAt },
  });
}

/** What the previous code's suspend route left: hidden, closed, reason copied into closedMessage. */
const legacySuspended = (closedMessage: string) =>
  createTestShop({ visible: false, status: "CLOSED", closedMessage });

async function legacyFixture() {
  const withReason = await legacySuspended("Hygiène");
  await audit(withReason, "shop.suspend", at("01T10:00:00"), { reason: "Hygiène" });
  await audit(withReason, "shop.update", at("03T10:00:00"), { field: "name" });

  const reactivatedThenHidden = await createTestShop({ visible: false });
  await audit(reactivatedThenHidden, "shop.suspend", at("01T11:00:00"), { reason: "Doute" });
  await audit(reactivatedThenHidden, "shop.reactivate", at("02T11:00:00"), {});

  const noReason = await legacySuspended(LEGACY_CLOSED_MESSAGE);
  await audit(noReason, "shop.reactivate", at("01T12:00:00"), {});
  await audit(noReason, "shop.suspend", at("02T12:00:00"), {});

  const republishedByOwner = await createTestShop({ visible: true, status: "OPEN" });
  await audit(republishedByOwner, "shop.suspend", at("02T13:00:00"), { reason: "Fraude" });

  const ownerMessage = await legacySuspended("Fermé pour travaux");
  await audit(ownerMessage, "shop.suspend", at("02T14:00:00"), { reason: "" });

  const neverModerated = await createTestShop({ visible: false });

  const alreadySuspended = await createTestShop({
    visible: false,
    suspendedAt: at("05T09:00:00"),
    suspendReason: "Posée par le nouveau code",
  });
  await audit(alreadySuspended, "shop.suspend", at("04T09:00:00"), { reason: "Ancienne" });

  return {
    backfilled: { withReason, noReason, ownerMessage },
    untouched: [reactivatedThenHidden, republishedByOwner, neverModerated, alreadySuspended],
  };
}

const MODERATION = {
  visible: true,
  status: true,
  vacationMode: true,
  closedMessage: true,
  suspendedAt: true,
  suspendReason: true,
} as const;
const moderation = (id: string) =>
  prisma.shop.findUniqueOrThrow({ where: { id }, select: MODERATION });

describe("rattrapage des suspensions faites par le code précédent", () => {
  it("le dry-run liste exactement les boutiques dont la dernière décision est une suspension", async () => {
    const { backfilled } = await legacyFixture();

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(DRY_RUN_SQL);

    expect(rows).toEqual([
      expect.objectContaining({
        id: backfilled.withReason.id,
        suspended_at: at("01T10:00:00"),
        audit_reason: "Hygiène",
        suspend_reason: "Hygiène",
        closed_message_cleared: true,
      }),
      expect.objectContaining({
        id: backfilled.noReason.id,
        suspended_at: at("02T12:00:00"),
        audit_reason: null,
        suspend_reason: GENERIC_REASON,
        closed_message_cleared: true,
      }),
      expect.objectContaining({
        id: backfilled.ownerMessage.id,
        suspended_at: at("02T14:00:00"),
        audit_reason: null,
        suspend_reason: GENERIC_REASON,
        closed_message: "Fermé pour travaux",
        closed_message_cleared: false,
      }),
    ]);
  });

  it("marque ces boutiques suspendues, une seule fois, sans toucher aux autres", async () => {
    const { backfilled, untouched } = await legacyFixture();
    const before = await Promise.all(untouched.map((shop) => moderation(shop.id)));

    const first = await prisma.$queryRawUnsafe<Array<{ id: string }>>(BACKFILL_SQL);
    const second = await prisma.$queryRawUnsafe<Array<{ id: string }>>(BACKFILL_SQL);

    const expectedIds = [backfilled.withReason, backfilled.noReason, backfilled.ownerMessage]
      .map((shop) => shop.id)
      .sort();
    expect(first.map((row) => row.id).sort()).toEqual(expectedIds);
    expect(second).toEqual([]);
    expect(await moderation(backfilled.withReason.id)).toEqual({
      visible: false,
      status: "CLOSED",
      vacationMode: false,
      closedMessage: null,
      suspendedAt: at("01T10:00:00"),
      suspendReason: "Hygiène",
    });
    expect(await moderation(backfilled.noReason.id)).toMatchObject({
      closedMessage: null,
      suspendedAt: at("02T12:00:00"),
      suspendReason: GENERIC_REASON,
    });
    expect(await moderation(backfilled.ownerMessage.id)).toMatchObject({
      closedMessage: "Fermé pour travaux",
      suspendedAt: at("02T14:00:00"),
      suspendReason: GENERIC_REASON,
    });
    expect(await Promise.all(untouched.map((shop) => moderation(shop.id)))).toEqual(before);
  });

  it("une boutique rattrapée est suspendue pour le nouveau code, qui sait la réactiver", async () => {
    const { backfilled } = await legacyFixture();
    await prisma.$queryRawUnsafe(BACKFILL_SQL);
    expect(shopPublication(await moderation(backfilled.withReason.id))).toBe("SUSPENDED");

    expect(await reactivateShop(backfilled.withReason.id)).toEqual({ ok: true });

    const row = await moderation(backfilled.withReason.id);
    expect(row).toEqual({
      visible: true,
      status: "OPEN",
      vacationMode: false,
      closedMessage: null,
      suspendedAt: null,
      suspendReason: null,
    });
    expect(shopPublication(row)).toBe("PUBLISHED");
  });
});
