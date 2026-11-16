// @vitest-environment node
// The owner's vacation restores only what it changed (C1-FAILLES-CRITIQUES, D11): it never lists a
// shop that was not listed before, and never reopens a suspended one. Real PostgreSQL.
import { describe, expect, it } from "vitest";
import { suspendShop } from "@/lib/services/shops/moderation";
import { getShopStatus } from "@/lib/shop-status";
import { endExpiredVacations, endVacationMode, setVacationMode } from "@/lib/shop-vacation";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const VACATION = {
  start: new Date("2026-12-20T00:00:00Z"),
  end: new Date("2027-01-05T00:00:00Z"),
};
const NOW = new Date("2026-11-15T10:00:00Z");
const SUSPENDED_AT = new Date("2026-11-14T08:00:00Z");

const PUBLICATION = {
  visible: true,
  status: true,
  suspendedAt: true,
  vacationMode: true,
  vacationStart: true,
  vacationEnd: true,
  vacationMessage: true,
} as const;
const publication = (id: string) =>
  prisma.shop.findUniqueOrThrow({ where: { id }, select: PUBLICATION });
const logs = (shopId: string) =>
  prisma.shopLog.findMany({
    where: { shopId },
    select: { action: true, details: true, triggeredBy: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

/** A listed shop that went on vacation through the owner's action, as the dashboard does it. */
async function shopOnVacation(end: Date = VACATION.end) {
  const shop = await createTestShop();
  expect(await setVacationMode(shop.id, { start: VACATION.start, end })).toEqual({ ok: true });
  return shop;
}

describe("début des congés", () => {
  it("refuse les congés à une boutique jamais publiée, sans rien écrire", async () => {
    const shop = await createTestShop({ visible: false });
    const before = await publication(shop.id);

    expect(await setVacationMode(shop.id, VACATION)).toEqual({
      ok: false,
      reason: "NOT_PUBLISHED",
    });

    expect(await publication(shop.id)).toEqual(before);
    expect(await logs(shop.id)).toEqual([]);
  });

  it("refuse les congés à une boutique suspendue, même encore listée", async () => {
    const shop = await createTestShop({ suspendedAt: SUSPENDED_AT, status: "CLOSED" });
    const before = await publication(shop.id);

    expect(await setVacationMode(shop.id, VACATION)).toEqual({ ok: false, reason: "SUSPENDED" });

    expect(await publication(shop.id)).toEqual(before);
    expect(await logs(shop.id)).toEqual([]);
  });

  it("une boutique déjà en congés peut en changer les dates", async () => {
    const shop = await shopOnVacation();
    const end = new Date("2027-01-10T00:00:00Z");

    expect(await setVacationMode(shop.id, { start: VACATION.start, end })).toEqual({ ok: true });

    expect(await publication(shop.id)).toMatchObject({ visible: false, vacationEnd: end });
  });
});

describe("fin des congés", () => {
  it("masque une boutique en ligne pendant ses congés, puis la remet en ligne et ouverte", async () => {
    const shop = await shopOnVacation();
    expect(await publication(shop.id)).toMatchObject({
      visible: false,
      status: "VACATION",
      vacationMode: true,
      vacationEnd: VACATION.end,
      vacationMessage: "Nous sommes en vacances, à bientôt !",
    });

    expect(await endVacationMode(shop.id)).toEqual({ ok: true });

    expect(await publication(shop.id)).toEqual({
      visible: true,
      status: "OPEN",
      suspendedAt: null,
      vacationMode: false,
      vacationStart: null,
      vacationEnd: null,
      vacationMessage: null,
    });
    expect(await logs(shop.id)).toEqual([
      {
        action: "VACATION_ON",
        details: "Du 2026-12-20T00:00:00.000Z au 2027-01-05T00:00:00.000Z",
        triggeredBy: "boucher",
      },
      { action: "VACATION_OFF", details: null, triggeredBy: "boucher" },
    ]);
  });

  it("« fin des congés » sur une boutique qui n'est pas en congés ne la publie pas", async () => {
    const shop = await createTestShop({ visible: false, status: "CLOSED" });

    expect(await endVacationMode(shop.id)).toEqual({ ok: false, reason: "NOT_ON_VACATION" });

    expect(await publication(shop.id)).toMatchObject({ visible: false, status: "CLOSED" });
    expect(await logs(shop.id)).toEqual([]);
  });

  it("« fin des congés » après une suspension ne rouvre pas la boutique", async () => {
    const shop = await shopOnVacation();
    expect(await suspendShop(shop.id, "Contrôle")).toEqual({ ok: true });

    expect(await endVacationMode(shop.id)).toEqual({ ok: false, reason: "SUSPENDED" });

    expect(await publication(shop.id)).toMatchObject({ visible: false, status: "CLOSED" });
  });

  it("« fin des congés » ne rouvre pas une boutique suspendue restée en congés", async () => {
    const shop = await shopOnVacation();
    await prisma.shop.update({ where: { id: shop.id }, data: { suspendedAt: SUSPENDED_AT } });

    expect(await endVacationMode(shop.id)).toEqual({ ok: false, reason: "SUSPENDED" });

    expect(await publication(shop.id)).toMatchObject({ visible: false, vacationMode: true });
  });

  it("l'expiration planifiée rouvre les congés échus, et seulement eux", async () => {
    const expired = await shopOnVacation(new Date("2026-11-15T09:59:59Z"));
    const endsAtNow = await shopOnVacation(NOW);
    const later = await shopOnVacation(new Date("2026-11-15T10:00:01Z"));
    const suspended = await shopOnVacation(new Date("2026-11-01T00:00:00Z"));
    await prisma.shop.update({ where: { id: suspended.id }, data: { suspendedAt: SUSPENDED_AT } });

    expect(await endExpiredVacations(NOW)).toBe(2);

    const reopened = { visible: true, status: "OPEN", vacationMode: false, vacationEnd: null };
    const stillAway = { visible: false, status: "VACATION", vacationMode: true };
    expect(await publication(expired.id)).toMatchObject(reopened);
    expect(await publication(endsAtNow.id)).toMatchObject(reopened);
    expect(await publication(later.id)).toMatchObject(stillAway);
    expect(await publication(suspended.id)).toMatchObject(stillAway);
  });

  it("le statut lu après des congés échus rouvre la boutique et la remet en ligne", async () => {
    const shop = await shopOnVacation(new Date("2020-01-01T00:00:00Z"));

    expect(await getShopStatus(shop.id)).toBe("OPEN");

    expect(await publication(shop.id)).toMatchObject({ visible: true, status: "OPEN" });
    expect((await logs(shop.id)).at(-1)).toEqual({
      action: "VACATION_OFF",
      details: null,
      triggeredBy: "system",
    });
  });

  it("le statut lu d'une boutique suspendue pendant ses congés échus reste fermé et masqué", async () => {
    const shop = await shopOnVacation(new Date("2020-01-01T00:00:00Z"));
    await prisma.shop.update({ where: { id: shop.id }, data: { suspendedAt: SUSPENDED_AT } });

    expect(await getShopStatus(shop.id)).toBe("VACATION");

    expect(await publication(shop.id)).toMatchObject({ visible: false, vacationMode: true });
  });
});
