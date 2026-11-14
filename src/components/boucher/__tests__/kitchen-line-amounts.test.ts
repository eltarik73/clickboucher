// @vitest-environment node
// Garde statique : le mode cuisine imprime le total stocké de chaque ligne (OrderItem.totalCents),
// jamais un montant recalculé « prix × quantité ». Une ligne légitimement à 0 € (poids ajusté à
// rien) doit afficher 0,00 €, et un prix ne se calcule que dans src/lib/pricing.
// (Les composants .tsx ne se chargent pas dans le projet Vitest `unit` : la garde lit la source.)
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../..");

const KITCHEN_FILES = [
  "src/components/boucher/KitchenOrderCard.tsx",
  "src/components/boucher/OrderAlertOverlay.tsx",
  "src/app/(boucher)/boucher/commandes/page.tsx",
];

const source = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

describe("kitchen line amounts", () => {
  it.each(KITCHEN_FILES)("%s never multiplies a price by a quantity", (file) => {
    expect(source(file)).not.toMatch(/priceCents\s*\*|\*\s*[\w.?]*priceCents/);
  });

  it.each(KITCHEN_FILES)("%s never replaces a stored total by a fallback", (file) => {
    expect(source(file)).not.toMatch(/totalCents\s*(\|\||\?\?)/);
  });

  it("the kitchen card prints each line's stored total", () => {
    expect(source("src/components/boucher/KitchenOrderCard.tsx")).toContain(
      "{formatPrice(item.totalCents)}"
    );
  });
});
