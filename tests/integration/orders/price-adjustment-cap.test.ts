// @vitest-environment node
// Le plafond de sécurité de la plateforme sur PostgreSQL réel : quelle que soit la marge du client,
// un ajustement ne dépasse jamais pa_max_increase_pct au-dessus du total de la commande, mesuré sur
// le total actuel ou, s'il est plus élevé, sur l'estimation des lignes encore livrées (marge
// figée) : une ligne pesée trop bas par erreur, même à 0, se repèse jusqu'à son estimation.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { invalidateConfig } from "@/lib/feature-flags";
import { MAX_INCREASE_PCT_KEY } from "@/lib/price-adjustment-config";
import { WEIGH_TOLERANCE_TERMS } from "@/lib/pricing/tolerance";
import { prisma, useCleanDatabase } from "../helpers/db";
import { adjustmentOf, reload, weighedOrder } from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const capRefusal = (cap: number) => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: `L'ajustement ne peut pas dépasser +${cap} % du total de la commande`,
});

describe("the platform's safety cap of one adjustment, whatever the tolerance", () => {
  afterEach(() => invalidateConfig(MAX_INCREASE_PCT_KEY));

  // Commande de 20,00 €, marge EXTENDED (2,00 €) : au plafond, la hausse attend le client.
  it.each([
    { stored: null, cap: 50, atCap: 3000 },
    { stored: "30", cap: 30, atCap: 2600 },
    // Pas un plafond valide (1 à 100) : le plafond par défaut s'applique.
    { stored: "0", cap: 50, atCap: 3000 },
  ])("stored $stored: up to +$cap % is proposed, one cent more is refused", async (row) => {
    if (row.stored !== null) {
      await prisma.platformConfig.create({
        data: { key: MAX_INCREASE_PCT_KEY, value: row.stored },
      });
      invalidateConfig(MAX_INCREASE_PCT_KEY);
    }
    const { order, firstLineAt } = await weighedOrder([2000], WEIGH_TOLERANCE_TERMS.EXTENDED);

    expect(await firstLineAt(row.atCap + 1)).toEqual(capRefusal(row.cap));
    expect(await prisma.priceAdjustment.count()).toBe(0);

    expect(await firstLineAt(row.atCap)).toMatchObject({ ok: true, data: { applied: false } });
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "PENDING", newTotal: row.atCap });
  });

  // Côte de 1 kg à 10,00 €, marge EXTENDED : pesée à 0,1 kg (ou à 0) par erreur, la commande vaut
  // 1,00 € (ou 0) ; le plafond se mesure alors sur l'estimation de la côte, 10,00 € (+50 % = 15,00 €).
  it.each([100, 0])(
    "a line weighed down to %i g by mistake is weighed back to its estimate, not beyond the cap of that estimate",
    async (grams) => {
      const { order, firstLineAt } = await weighedOrder([1000], WEIGH_TOLERANCE_TERMS.EXTENDED);
      expect(await firstLineAt(grams)).toMatchObject({ ok: true, data: { applied: true } });
      expect((await reload(order.id)).totalCents).toBe(grams);

      expect(await firstLineAt(1501)).toEqual(capRefusal(50));
      expect(await firstLineAt(1000)).toMatchObject({
        ok: true,
        data: { applied: true, decision: { decision: "APPLY", reason: "WITHIN_TOLERANCE" } },
      });
      expect((await reload(order.id)).totalCents).toBe(1000);
    }
  );
});
