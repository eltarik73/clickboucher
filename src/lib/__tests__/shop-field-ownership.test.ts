// @vitest-environment node
// Garde : à qui appartient chaque colonne de Shop (C1-FAILLES-CRITIQUES, D1).
//
// Le boucher ne choisit la valeur que des colonnes d'OWNER_EDITABLE. Toutes les autres sont à la
// plateforme (commission, palier, publication, modération, photos, Stripe, métriques…) et ne
// figurent dans aucun schéma accepté par une route du boucher : une clé hors schéma répond 400 et
// rien n'est écrit. Une colonne de la plateforme peut changer comme effet d'une action du boucher
// décidée par le serveur (les congés retirent la boutique de la liste, la reprise remet à zéro les
// compteurs d'auto-pause), mais sa valeur ne vient jamais de la requête. Qui écrit la publication :
// shop-visible-writers.test.ts.
//
// Une colonne ajoutée au modèle Shop fait échouer ce test tant qu'elle n'est pas classée ici.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { shopStatusActionSchema } from "@/app/api/boucher/shop/status/action-schema";
import { ownerShopUpdateSchema, updateServiceSchema, updateShopSchema } from "@/lib/validators";

type ShopColumn = Prisma.ShopScalarFieldEnum;

const FORBIDDEN_FIELD_MESSAGE = "Ce champ ne peut pas être modifié ici";

/** Colonnes dont la valeur vient d'une requête du boucher sur SA boutique. */
const OWNER_EDITABLE = [
  // PATCH /api/shops/[id] (ownerShopUpdateSchema) : fiche et réglages de la boutique.
  "name",
  "address",
  "city",
  "phone",
  "email",
  "description",
  "welcomeMessage",
  "closedMessage",
  "minOrderCents",
  "openingHours",
  "pickupSlots",
  "latitude",
  "longitude",
  "deliveryRadius",
  "acceptOnline",
  "acceptOnPickup",
  "priceAdjustmentThreshold",
  // Majoration en ligne du boucher lui-même (ProductFormPage), pas une règle de commission.
  "commissionMarkupPercent",
  "priceRoundingEnabled",
  // PATCH /api/shops/[id]/status (updateServiceSchema).
  "prepTimeMin",
  "busyMode",
  "busyExtraMin",
  "paused",
  "status",
  "autoAccept",
  "maxOrdersPerHour",
  // PATCH /api/boucher/shop/status : effets des actions pause, busy, vacation et update_settings.
  "pausedAt",
  "pauseReason",
  "pauseEndsAt",
  "busyModeEndsAt",
  "vacationMode",
  "vacationStart",
  "vacationEnd",
  "vacationMessage",
  "acceptTimeoutMin",
  "maxOrdersPerSlot",
  "autoBusyThreshold",
  "soundNotif",
  "flashNotif",
  "vibrateNotif",
  // PATCH /api/boucher/onboarding { complete: true } : la liste de démarrage, pas une validation.
  "onboardingCompleted",
] as const satisfies readonly ShopColumn[];

/** Colonnes de la plateforme : dans aucun schéma accepté par une route du boucher. */
const PLATFORM_OWNED = [
  // Identité et rattachement.
  "id",
  "slug",
  "ownerId",
  "ownerName",
  "createdAt",
  "updatedAt",
  // Commission et palier : routes admin auditées, cron des paliers.
  "commissionPct",
  "commissionEnabled",
  "tier",
  "monthlyGmvCents",
  "earlyAdopterUntil",
  // Publication et modération : src/lib/services/shops/moderation.ts (et les congés pour visible).
  "visible",
  "featured",
  "validatedAt",
  "suspendedAt",
  "suspendReason",
  // Photos : webmaster.
  "imageUrl",
  "bannerUrl",
  "ownerPhotoUrl",
  // Calculées par le serveur : avis, auto-pause, présence, métriques.
  "rating",
  "ratingCount",
  "autoPaused",
  "autoPausedAt",
  "missedOrdersCount",
  "lastSeenAt",
  "cachedAcceptanceRate",
  "cachedAvgPrepMinutes",
  "cachedCancelRate",
  "cachedResponseMinutes",
  "cachedLateRate",
  "cachedAvgRating",
  "performanceScore",
  "metricsUpdatedAt",
  // Réglage de l'administration (/api/admin/shops/[shopId]) ou sans écran du boucher.
  "defaultBusyDurationMin",
  "autoPauseThreshold",
  "closedUntil",
  "onboardingStep",
  // Stripe Connect : synchronisé depuis Stripe (état du compte : webhook account.updated).
  "stripeAccountId",
  "stripeAccountStatus",
  "stripeChargesEnabled",
  "stripePayoutsEnabled",
  "stripeRequirementsDue",
  "stripeDisabledReason",
  "stripeCardPaymentsActive",
  // Parrainage : code généré par le serveur.
  "shopReferralCode",
  "referredByShop",
  // Informations légales et qualité (TVA du boucher : commission HT et ses factures).
  "vatRate",
  "vatNumber",
  "vatFranchise",
  "siret",
  "legalName",
  "fullAddress",
  "qrCodeEnabled",
  "halalCertUrl",
  "defaultHalalOrg",
  "defaultOrigin",
] as const satisfies readonly ShopColumn[];

/** Clés d'action de PATCH /api/boucher/shop/status qui ne sont pas des colonnes : ce qu'elles remplissent. */
const ACTION_PAYLOAD_COLUMNS = {
  reason: ["pauseReason"],
  durationMin: ["pauseEndsAt", "busyModeEndsAt"],
  extraMin: ["busyExtraMin"],
  start: ["vacationStart"],
  end: ["vacationEnd"],
  message: ["vacationMessage"],
} as const satisfies Record<string, readonly (typeof OWNER_EDITABLE)[number][]>;

type ShopStatusActionInput = z.input<typeof shopStatusActionSchema>;
type ShopStatusActionName = ShopStatusActionInput["action"];

/** Une requête valide et minimale par action : la clé ajoutée ensuite est la seule cause d'un refus. */
const MINIMAL_ACTIONS: {
  [A in ShopStatusActionName]: Extract<ShopStatusActionInput, { action: A }>;
} = {
  pause: { action: "pause" },
  resume: { action: "resume" },
  busy: { action: "busy", extraMin: 15, durationMin: 30 },
  end_busy: { action: "end_busy" },
  vacation: {
    action: "vacation",
    start: "2026-12-20T00:00:00.000Z",
    end: "2026-12-27T00:00:00.000Z",
  },
  end_vacation: { action: "end_vacation" },
  close: { action: "close" },
  update_settings: { action: "update_settings" },
};

const SHOP_COLUMNS: readonly string[] = Object.keys(Prisma.ShopScalarFieldEnum);
const OWNER_SET = new Set<string>(OWNER_EDITABLE);
const PLATFORM_SET = new Set<string>(PLATFORM_OWNED);
const ACTION_MEMBERS = shopStatusActionSchema.innerType().options;

const duplicates = (list: readonly string[]) => list.filter((key, i) => list.indexOf(key) !== i);
const notOwnerEditable = (keys: readonly string[]) => keys.filter((key) => !OWNER_SET.has(key));

/** Refusée avec le message français, pour la seule clé en trop. */
function expectForbiddenKeyRefusal(schema: z.ZodTypeAny, body: Record<string, unknown>) {
  const result = schema.safeParse(body);
  expect(result.success).toBe(false);
  expect(result.error?.issues).toEqual([
    expect.objectContaining({
      code: "unrecognized_keys",
      keys: ["commissionPct"],
      message: FORBIDDEN_FIELD_MESSAGE,
    }),
  ]);
}

describe("classement des colonnes de Shop", () => {
  it("chaque colonne du modèle est classée une seule fois, et rien d'autre", () => {
    const classified = [...OWNER_EDITABLE, ...PLATFORM_OWNED];
    expect(
      SHOP_COLUMNS.filter((column) => !OWNER_SET.has(column) && !PLATFORM_SET.has(column))
    ).toEqual([]);
    expect(classified.filter((column) => !SHOP_COLUMNS.includes(column))).toEqual([]);
    expect(OWNER_EDITABLE.filter((column) => PLATFORM_SET.has(column))).toEqual([]);
    expect(duplicates(classified)).toEqual([]);
  });

  it("les clés d'action qui ne sont pas des colonnes ne cachent aucune colonne de Shop", () => {
    expect(Object.keys(ACTION_PAYLOAD_COLUMNS).filter((key) => SHOP_COLUMNS.includes(key))).toEqual(
      []
    );
  });
});

describe("schémas acceptés par les routes du boucher", () => {
  it("PATCH /api/shops/[id] (ownerShopUpdateSchema) n'accepte que des colonnes du boucher", () => {
    expect(notOwnerEditable(Object.keys(ownerShopUpdateSchema.shape))).toEqual([]);
  });

  it("PATCH /api/shops/[id]/status (updateServiceSchema) n'accepte que des colonnes du boucher", () => {
    expect(notOwnerEditable(Object.keys(updateServiceSchema.shape))).toEqual([]);
  });

  it.each(ACTION_MEMBERS.map((member) => [member.shape.action.value, member] as const))(
    "PATCH /api/boucher/shop/status, action %s : n'accepte que des colonnes du boucher",
    (_action, member) => {
      const keys = Object.keys(member.shape).filter(
        (key) => key !== "action" && !(key in ACTION_PAYLOAD_COLUMNS)
      );
      expect(notOwnerEditable(keys)).toEqual([]);
    }
  );

  it("chaque clé d'action non-colonne listée est encore reçue par une action", () => {
    const received = new Set(ACTION_MEMBERS.flatMap((member) => Object.keys(member.shape)));
    expect(Object.keys(ACTION_PAYLOAD_COLUMNS).filter((key) => !received.has(key))).toEqual([]);
  });

  it("la table des requêtes minimales couvre chaque action, et chacune est valide", () => {
    expect(Object.keys(MINIMAL_ACTIONS).sort()).toEqual(
      ACTION_MEMBERS.map((member) => member.shape.action.value).sort()
    );
    for (const body of Object.values(MINIMAL_ACTIONS)) {
      expect(shopStatusActionSchema.safeParse(body).success).toBe(true);
    }
  });
});

describe("schéma de l'administration (updateShopSchema)", () => {
  it("n'a ni commission, ni palier, ni publication", () => {
    const keys = Object.keys(updateShopSchema.shape);
    for (const forbidden of ["commissionPct", "commissionEnabled", "tier", "visible"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("vaut les champs du boucher plus les deux photos, rien d'autre", () => {
    expect(Object.keys(updateShopSchema.shape).sort()).toEqual(
      [...Object.keys(ownerShopUpdateSchema.shape), "imageUrl", "bannerUrl"].sort()
    );
  });
});

describe("une colonne de la plateforme envoyée est refusée, en français", () => {
  it.each([
    ["ownerShopUpdateSchema", ownerShopUpdateSchema],
    ["updateShopSchema", updateShopSchema],
    ["updateServiceSchema", updateServiceSchema],
  ] as const)("%s refuse { commissionPct: 0 }", (_name, schema) => {
    expectForbiddenKeyRefusal(schema, { commissionPct: 0 });
  });

  it.each(Object.entries(MINIMAL_ACTIONS))(
    "shopStatusActionSchema, action %s, refuse commissionPct",
    (_action, body) => {
      expectForbiddenKeyRefusal(shopStatusActionSchema, { ...body, commissionPct: 0 });
    }
  );
});
