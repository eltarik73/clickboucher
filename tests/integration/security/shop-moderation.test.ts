// @vitest-environment node
// The platform's decisions on a shop (C1-FAILLES-CRITIQUES, D8, D9, D14): a suspension is a
// stored state that only the admin writes and lifts, and nothing publishes a suspended shop.
// Real PostgreSQL, nothing mocked.
import { describe, expect, it } from "vitest";
import {
  approveShop,
  reactivateShop,
  setShopPublished,
  suspendShop,
} from "@/lib/services/shops/moderation";
import { shopPublication } from "@/lib/shop-publication";
import { endVacationMode, setVacationMode, shopSuspension } from "@/lib/shop-status";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const SUSPENDED_ADMIN = "Boutique suspendue : réactivez-la d'abord";
const MISSING_SHOP = "boutique-inconnue";

const shopRow = (id: string) => prisma.shop.findUniqueOrThrow({ where: { id } });
const logs = (shopId: string) =>
  prisma.shopLog.findMany({
    where: { shopId },
    select: { action: true, details: true, triggeredBy: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
const actions = async (shopId: string) => (await logs(shopId)).map((log) => log.action);
const conflict = (message: string) => ({ ok: false, code: "CONFLICT", message });

describe("suspension : posée et levée par l'administration seule", () => {
  it("suspend une boutique en ligne, en pause, débordée et en congés : tout est coupé", async () => {
    const at = new Date("2026-11-15T08:00:00Z");
    const later = new Date("2026-11-15T12:00:00Z");
    const shop = await createTestShop({
      status: "PAUSED",
      closedMessage: "Fermé le lundi",
      paused: true,
      pausedAt: at,
      pauseEndsAt: later,
      pauseReason: "Rush",
      autoPaused: true,
      autoPausedAt: at,
      busyMode: true,
      busyModeEndsAt: later,
      vacationMode: true,
      vacationStart: new Date("2026-12-20T00:00:00Z"),
      vacationEnd: new Date("2027-01-05T00:00:00Z"),
      vacationMessage: "En congés",
    });
    const before = new Date();

    expect(await suspendShop(shop.id, "Hygiène non conforme")).toEqual({ ok: true });

    const row = await shopRow(shop.id);
    expect(row).toMatchObject({
      suspendReason: "Hygiène non conforme",
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
      vacationMode: false,
      vacationStart: null,
      vacationEnd: null,
      vacationMessage: null,
      closedMessage: "Fermé le lundi",
    });
    expect(row.suspendedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(shopPublication(row)).toBe("SUSPENDED");
    expect(await logs(shop.id)).toEqual([
      { action: "SUSPENDED", details: "Hygiène non conforme", triggeredBy: "admin" },
    ]);
  });

  it("une seconde suspension est refusée et ne réécrit ni la date ni le motif", async () => {
    const shop = await createTestShop();
    await suspendShop(shop.id, "Premier motif");
    const first = await shopRow(shop.id);

    expect(await suspendShop(shop.id, "Second motif")).toEqual(
      conflict("La boutique est déjà suspendue")
    );

    const second = await shopRow(shop.id);
    expect(second.suspendedAt).toEqual(first.suspendedAt);
    expect(second.suspendReason).toBe("Premier motif");
    expect(await actions(shop.id)).toEqual(["SUSPENDED"]);
  });

  it.each([1, 2, 3])("deux suspensions simultanées : une seule passe (tour %i)", async () => {
    const shop = await createTestShop();

    const results = await Promise.all([suspendShop(shop.id, "A"), suspendShop(shop.id, "B")]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      conflict("La boutique est déjà suspendue"),
    ]);
    expect(await actions(shop.id)).toEqual(["SUSPENDED"]);
  });

  it("la réactivation remet la boutique en ligne et ouverte", async () => {
    const shop = await createTestShop();
    await suspendShop(shop.id, "Contrôle");

    expect(await reactivateShop(shop.id)).toEqual({ ok: true });

    const row = await shopRow(shop.id);
    expect(row).toMatchObject({
      suspendedAt: null,
      suspendReason: null,
      visible: true,
      status: "OPEN",
    });
    expect(shopPublication(row)).toBe("PUBLISHED");
    expect(await logs(shop.id)).toEqual([
      { action: "SUSPENDED", details: "Contrôle", triggeredBy: "admin" },
      { action: "REACTIVATED", details: null, triggeredBy: "admin" },
    ]);
  });

  it("shopSuspension rend la date et le motif tant que la boutique est suspendue", async () => {
    const shop = await createTestShop({ visible: false });
    expect(await shopSuspension(shop.id)).toBeNull();
    expect(await shopSuspension(MISSING_SHOP)).toBeNull();

    await suspendShop(shop.id, "Contrôle");
    const { suspendedAt } = await shopRow(shop.id);
    expect(await shopSuspension(shop.id)).toEqual({ suspendedAt, reason: "Contrôle" });

    await reactivateShop(shop.id);
    expect(await shopSuspension(shop.id)).toBeNull();
  });

  it("refuse de « réactiver » une boutique jamais publiée, qui reste hors ligne", async () => {
    const shop = await createTestShop({ visible: false });

    expect(await reactivateShop(shop.id)).toEqual(conflict("La boutique n'est pas suspendue"));

    expect(await shopRow(shop.id)).toMatchObject({ visible: false, suspendedAt: null });
    expect(await logs(shop.id)).toEqual([]);
  });
});

describe("validation et publication", () => {
  it("la validation publie la boutique et date l'acte", async () => {
    const shop = await createTestShop({ visible: false, onboardingCompleted: false });
    const before = new Date();

    expect(await approveShop(shop.id)).toEqual({ ok: true });

    const row = await shopRow(shop.id);
    expect(row).toMatchObject({ visible: true, onboardingCompleted: true });
    expect(row.validatedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(await logs(shop.id)).toEqual([
      { action: "APPROVED", details: null, triggeredBy: "admin" },
    ]);
  });

  it.each([
    ["la validation", (id: string) => approveShop(id)],
    ["la publication", (id: string) => setShopPublished(id, true)],
  ])("%s d'une boutique suspendue est refusée", async (_label, publish) => {
    const shop = await createTestShop({ onboardingCompleted: false });
    await suspendShop(shop.id, "Contrôle");

    expect(await publish(shop.id)).toEqual(conflict(SUSPENDED_ADMIN));

    const row = await shopRow(shop.id);
    expect(row).toMatchObject({ visible: false, validatedAt: null, onboardingCompleted: false });
    expect(shopPublication(row)).toBe("SUSPENDED");
    expect(await actions(shop.id)).toEqual(["SUSPENDED"]);
  });

  it("la publication remet en ligne une boutique masquée par l'administration", async () => {
    const shop = await createTestShop({ visible: false });

    expect(await setShopPublished(shop.id, true)).toEqual({ ok: true });

    expect(await shopRow(shop.id)).toMatchObject({ visible: true });
    expect(await logs(shop.id)).toEqual([
      { action: "PUBLISHED", details: null, triggeredBy: "admin" },
    ]);
  });

  it("la validation d'une boutique en congés la valide sans la lister : sa fin de congés la met en ligne", async () => {
    const shop = await createTestShop({
      visible: false,
      onboardingCompleted: false,
      status: "VACATION",
      vacationMode: true,
      vacationStart: new Date("2026-12-20T00:00:00Z"),
      vacationEnd: new Date("2027-01-05T00:00:00Z"),
      vacationMessage: "En congés",
    });
    const before = new Date();

    expect(await approveShop(shop.id)).toEqual({ ok: true });

    const approved = await shopRow(shop.id);
    expect(approved).toMatchObject({
      visible: false,
      vacationMode: true,
      onboardingCompleted: true,
    });
    expect(approved.validatedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(shopPublication(approved)).toBe("ON_VACATION");
    expect(await logs(shop.id)).toEqual([
      { action: "APPROVED", details: null, triggeredBy: "admin" },
    ]);

    expect(await endVacationMode(shop.id)).toEqual({ ok: true });
    const back = await shopRow(shop.id);
    expect(back).toMatchObject({ visible: true, vacationMode: false, status: "OPEN" });
    expect(shopPublication(back)).toBe("PUBLISHED");
  });

  it("la publication d'une boutique en congés est refusée et n'écrit rien", async () => {
    const shop = await createTestShop();
    const start = new Date("2026-12-20T00:00:00Z");
    const end = new Date("2027-01-05T00:00:00Z");
    expect(await setVacationMode(shop.id, { start, end })).toEqual({ ok: true });
    const onVacation = await shopRow(shop.id);

    expect(await setShopPublished(shop.id, true)).toEqual(
      conflict("Boutique en vacances : elle sera remise en ligne à la fin des vacances")
    );

    expect(await shopRow(shop.id)).toEqual(onVacation);
    expect(await actions(shop.id)).toEqual(["VACATION_ON"]);
  });

  it("la mise hors ligne annule les congés, que leur fin ne peut plus republier", async () => {
    const shop = await createTestShop();
    const start = new Date("2026-12-20T00:00:00Z");
    const end = new Date("2027-01-05T00:00:00Z");
    expect(await setVacationMode(shop.id, { start, end })).toEqual({ ok: true });

    expect(await setShopPublished(shop.id, false)).toEqual({ ok: true });

    expect(await shopRow(shop.id)).toMatchObject({
      visible: false,
      status: "CLOSED",
      vacationMode: false,
      vacationStart: null,
      vacationEnd: null,
      vacationMessage: null,
    });
    expect(await endVacationMode(shop.id)).toEqual({ ok: false, reason: "NOT_ON_VACATION" });
    expect(await shopRow(shop.id)).toMatchObject({ visible: false });
    expect(await actions(shop.id)).toEqual(["VACATION_ON", "UNPUBLISHED"]);
  });

  it("la mise hors ligne d'une boutique ouverte, hors congés, garde son statut", async () => {
    const shop = await createTestShop({ status: "OPEN" });

    expect(await setShopPublished(shop.id, false)).toEqual({ ok: true });

    expect(await shopRow(shop.id)).toMatchObject({ visible: false, status: "OPEN" });
    expect(await actions(shop.id)).toEqual(["UNPUBLISHED"]);
  });

  it.each([
    ["suspendShop", () => suspendShop(MISSING_SHOP, "Motif")],
    ["reactivateShop", () => reactivateShop(MISSING_SHOP)],
    ["approveShop", () => approveShop(MISSING_SHOP)],
    ["setShopPublished(true)", () => setShopPublished(MISSING_SHOP, true)],
    ["setShopPublished(false)", () => setShopPublished(MISSING_SHOP, false)],
  ])("%s sur une boutique inconnue : NOT_FOUND", async (_label, decide) => {
    expect(await decide()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Boutique introuvable",
    });
  });
});
