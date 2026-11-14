// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  productPriceAudience,
  proProductSelect,
  publicProductSelect,
  publicShopSelect,
} from "@/lib/public-projections";

const FORBIDDEN_SHOP_KEYS = [
  "ownerId",
  "email",
  "stripeAccountId",
  "stripeAccountStatus",
  "commissionPct",
  "commissionEnabled",
  "commissionMarkupPercent",
  "tier",
  "monthlyGmvCents",
  "siret",
  "legalName",
  "suspendReason",
  "missedOrdersCount",
  "autoAccept",
];

const FORBIDDEN_SHOP_PATTERN = /stripe(?!ChargesEnabled)|commission|gmv|performance|cached/i;

describe("publicShopSelect", () => {
  const keys = Object.keys(publicShopSelect);

  it.each(FORBIDDEN_SHOP_KEYS)("ne sélectionne pas %s", (key) => {
    expect(keys).not.toContain(key);
  });

  it("ne sélectionne aucun champ Stripe interne, de commission, de chiffre d'affaires ou de métrique", () => {
    expect(keys.filter((key) => FORBIDDEN_SHOP_PATTERN.test(key))).toEqual([]);
  });

  it("sélectionne les trois indicateurs de paiement lus par le panier", () => {
    expect(publicShopSelect).toMatchObject({
      acceptOnline: true,
      acceptOnPickup: true,
      stripeChargesEnabled: true,
    });
  });

  it("ne sélectionne que des valeurs true (liste blanche explicite)", () => {
    expect(Object.values(publicShopSelect).every((value) => value === true)).toBe(true);
  });
});

describe("publicProductSelect", () => {
  const keys = Object.keys(publicProductSelect);

  it.each(["proPriceCents", "boutiquePriceCents", "vatRate", "snoozeReason", "referenceId"])(
    "ne sélectionne pas %s",
    (key) => {
      expect(keys).not.toContain(key);
    }
  );

  it("sélectionne ce que la vitrine affiche : prix, unité, bornes de poids, promotion, découpes", () => {
    expect(publicProductSelect).toMatchObject({
      id: true,
      priceCents: true,
      unit: true,
      minWeightG: true,
      weightStepG: true,
      maxWeightG: true,
      promoPct: true,
      promoEnd: true,
      promoType: true,
      promoFixedCents: true,
      cutOptions: true,
    });
    expect(keys).toEqual(expect.arrayContaining(["images", "labels", "categories"]));
  });

  it("sélectionne les deux modes à stock limité et leurs compteurs : la vitrine affiche « Épuisé »", () => {
    expect(publicProductSelect).toMatchObject({
      isAntiGaspi: true,
      antiGaspiStock: true,
      isFlashSale: true,
      flashSaleStock: true,
    });
  });
});

describe("proProductSelect", () => {
  it("ajoute le seul tarif pro à la projection publique", () => {
    const { proPriceCents, ...rest } = proProductSelect;
    expect(proPriceCents).toBe(true);
    expect(rest).toEqual(publicProductSelect);
    expect(Object.keys(proProductSelect)).not.toContain("boutiquePriceCents");
  });
});

describe("productPriceAudience", () => {
  const stranger = { ids: ["user_x", "cm_x"], shopOwnerId: "cm_owner" };

  it("visiteur anonyme : public", () => {
    expect(productPriceAudience(null)).toBe("PUBLIC");
  });

  it.each([
    [{ ...stranger, role: "CLIENT" }, "PUBLIC"],
    [{ ...stranger, role: undefined }, "PUBLIC"],
    [{ ...stranger, role: "BOUCHER" }, "PUBLIC"],
    [{ ...stranger, role: "CLIENT_PRO_PENDING" }, "PUBLIC"],
    [{ ...stranger, role: "CLIENT_PRO" }, "PRO"],
    [{ ...stranger, role: "ADMIN" }, "MANAGER"],
    [{ ...stranger, role: "webmaster" }, "MANAGER"],
    [{ role: "BOUCHER", ids: ["user_o", "cm_owner"], shopOwnerId: "cm_owner" }, "MANAGER"],
    [{ role: "BOUCHER", ids: ["user_o", "cm_o"], shopOwnerId: "user_o" }, "MANAGER"],
    [
      { role: undefined, ids: ["user_o", undefined, "cm_owner"], shopOwnerId: "cm_owner" },
      "MANAGER",
    ],
    [{ role: "BOUCHER", ids: [null, undefined], shopOwnerId: null }, "PUBLIC"],
    [{ role: "BOUCHER", ids: ["user_o"], shopOwnerId: undefined }, "PUBLIC"],
  ] as const)("%o => %s", (viewer, expected) => {
    expect(productPriceAudience(viewer)).toBe(expected);
  });
});
