// @vitest-environment node
// E09-02 : un boucher publiait dans la popup de l'accueil, montrée à chaque visiteur, une offre à
// texte libre et image distante en envoyant diffPopup et les champs popup* à POST /api/shop/offers.
// Deux barrières, sur PostgreSQL réel : la route refuse tout champ de diffusion popup ou bannière
// venant d'un boucher, et la popup de l'accueil ne lit que les offres de la plateforme (sans
// boutique), même si une ligne de boutique porte diffPopup. Simulé : le helper d'auth boucher.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);

import { POST as createButcherOffer } from "@/app/api/shop/offers/route";
import { listPopupOffers, listPublicOffers } from "@/lib/public-offers";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer, createTestShop } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;

let shopId: string;

beforeEach(async () => {
  const shop = await createTestShop({ name: "Boucherie du Lac" });
  shopId = shop.id;
  boucherAuth.getAuthenticatedBoucher.mockResolvedValue({ userId: "user_boucher_itest", shopId });
});

/** Le corps qu'envoie ButcherOfferForm, seul client légitime de la route. */
function formBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    name: "Promo du week-end",
    code: "WEEKEND10",
    type: "PERCENT",
    discountValue: 10,
    minOrder: 0,
    payer: "BUTCHER",
    audience: "ALL",
    startDate: new Date(now - DAY_MS).toISOString(),
    endDate: new Date(now + 7 * DAY_MS).toISOString(),
    maxUses: null,
    diffBadge: true,
    diffBanner: false,
    diffPopup: false,
    ...overrides,
  };
}

function post(body: Record<string, unknown>) {
  return createButcherOffer(
    new NextRequest("http://localhost/api/shop/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code: string } };
  return body.error?.code;
}

describe("POST /api/shop/offers : un boucher ne publie ni popup ni bannière", () => {
  it.each([
    ["diffPopup: true", { diffPopup: true }],
    ["diffBanner: true", { diffBanner: true }],
    ["popupTitle", { popupTitle: "Titre libre du boucher" }],
    ["popupMessage", { popupMessage: "Message libre" }],
    ["popupColor", { popupColor: "black" }],
    ["popupFrequency", { popupFrequency: "always" }],
    ["popupImageUrl", { popupImageUrl: "https://tracker.example.org/pixel.png" }],
    ["bannerTitle", { bannerTitle: "Titre libre" }],
    ["bannerSubtitle", { bannerSubtitle: "Sous-titre libre" }],
    ["bannerColor", { bannerColor: "black" }],
    ["bannerPosition", { bannerPosition: "discover_top" }],
    ["bannerImageUrl", { bannerImageUrl: "https://tracker.example.org/banner.png" }],
    ["un autre payeur", { payer: "KLIKGO" }],
    ["une autre boutique", { shopId: "shop_autre" }],
  ])("répond 400 VALIDATION_ERROR à %s et n'écrit aucune offre", async (_label, overrides) => {
    const res = await post(formBody(overrides));

    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("VALIDATION_ERROR");
    expect(await prisma.offer.count()).toBe(0);
  });

  it("crée l'offre envoyée par le formulaire, payée par le boucher, sans popup ni bannière", async () => {
    const res = await post(formBody());

    expect(res.status).toBe(201);
    const offer = await prisma.offer.findUniqueOrThrow({ where: { code: "WEEKEND10" } });
    expect(offer).toMatchObject({
      shopId,
      payer: "BUTCHER",
      status: "ACTIVE",
      diffBadge: true,
      diffBanner: false,
      diffPopup: false,
      bannerTitle: null,
      bannerImageUrl: null,
      popupTitle: null,
      popupMessage: null,
      popupImageUrl: null,
    });
  });

  it("crée aussi l'offre quand le corps omet payer, diffBanner et diffPopup", async () => {
    const body = formBody();
    delete body.payer;
    delete body.diffBanner;
    delete body.diffPopup;

    const res = await post(body);

    expect(res.status).toBe(201);
    const offer = await prisma.offer.findUniqueOrThrow({ where: { code: "WEEKEND10" } });
    expect(offer).toMatchObject({ shopId, payer: "BUTCHER", diffBanner: false, diffPopup: false });
  });
});

describe("popup de l'accueil : offres de la plateforme seulement", () => {
  it("ignore une offre de boutique marquée diffPopup en base, garde l'offre de la plateforme", async () => {
    await createTestOffer({
      shopId,
      payer: "BUTCHER",
      code: "RECPOP",
      diffBadge: false,
      diffPopup: true,
      popupTitle: "Titre libre du boucher",
      popupImageUrl: "https://tracker.example.org/pixel.png",
    });
    const platform = await createTestOffer({ code: "PLATEFORME", diffPopup: true });

    const popup = await listPopupOffers(new Date(), 3);

    expect(popup.map((offer) => offer.id)).toEqual([platform.id]);
  });

  it("une offre de boutique diffusée par la seule popup n'est publique nulle part", async () => {
    await createTestOffer({
      shopId,
      payer: "BUTCHER",
      code: "RECPOP",
      diffBadge: false,
      diffPopup: true,
    });

    expect(await listPublicOffers(new Date())).toEqual([]);
  });
});
