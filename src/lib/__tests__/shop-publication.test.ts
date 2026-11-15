// @vitest-environment node
// The one publication predicate (C1-FAILLES-CRITIQUES, D10): a suspension wins over everything,
// then the listing, then the vacation. Read by the shop page, order intake and the public shop API.
import { describe, expect, it } from "vitest";
import {
  isShopPageReachable,
  shopOrderRefusalMessage,
  shopPublication,
  type ShopPublication,
  type ShopPublicationFacts,
} from "@/lib/shop-publication";

const SUSPENDED_AT = new Date("2026-11-15T09:30:00.000Z");

// visible, suspended, vacationMode -> publication, page reachable: the 8 combinations.
const CASES: Array<[boolean, boolean, boolean, ShopPublication, boolean]> = [
  [true, false, false, "PUBLISHED", true],
  [true, false, true, "PUBLISHED", true],
  [false, false, true, "ON_VACATION", true],
  [false, false, false, "UNPUBLISHED", false],
  [true, true, false, "SUSPENDED", false],
  [true, true, true, "SUSPENDED", false],
  [false, true, true, "SUSPENDED", false],
  [false, true, false, "SUSPENDED", false],
];

const facts = (
  visible: boolean,
  suspended: boolean,
  vacationMode: boolean
): ShopPublicationFacts => ({
  visible,
  suspendedAt: suspended ? SUSPENDED_AT : null,
  vacationMode,
});

describe("shopPublication", () => {
  it.each(CASES)(
    "visible=%s, suspendue=%s, vacances=%s -> %s",
    (visible, suspended, vacationMode, publication) => {
      expect(shopPublication(facts(visible, suspended, vacationMode))).toBe(publication);
    }
  );

  it("lit une date de suspension restaurée d'un cache JSON (chaîne ISO) comme une suspension", () => {
    const fromCache = {
      visible: true,
      suspendedAt: SUSPENDED_AT.toISOString(),
      vacationMode: false,
    };
    expect(shopPublication(fromCache)).toBe("SUSPENDED");
    expect(isShopPageReachable(fromCache)).toBe(false);
  });
});

describe("isShopPageReachable", () => {
  it.each(CASES)(
    "visible=%s, suspendue=%s, vacances=%s (%s) -> page accessible : %s",
    (visible, suspended, vacationMode, _publication, reachable) => {
      expect(isShopPageReachable(facts(visible, suspended, vacationMode))).toBe(reachable);
    }
  );
});

describe("shopOrderRefusalMessage", () => {
  it("n'oppose aucun refus à une boutique en ligne, même marquée en vacances", () => {
    expect(shopOrderRefusalMessage(facts(true, false, false))).toBeNull();
    expect(shopOrderRefusalMessage(facts(true, false, true))).toBeNull();
  });

  it("répond « en vacances » à une boutique en congés", () => {
    expect(shopOrderRefusalMessage(facts(false, false, true))).toBe("La boutique est en vacances");
  });

  it.each([
    ["suspendue et encore listée", facts(true, true, false)],
    ["suspendue pendant ses congés", facts(false, true, true)],
    ["suspendue", facts(false, true, false)],
    ["jamais publiée", facts(false, false, false)],
  ])("refuse une boutique %s sans dire pourquoi au client", (_label, shop) => {
    expect(shopOrderRefusalMessage(shop)).toBe(
      "Cette boucherie n'est pas disponible à la commande pour le moment."
    );
  });
});
