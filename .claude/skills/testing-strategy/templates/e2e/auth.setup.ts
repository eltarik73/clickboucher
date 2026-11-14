// Destination : tests/e2e/auth.setup.ts (projet `setup`, dont dépendent les projets qui écrivent).
// 1. Refuse une base qui n'est pas jetable, avant toute écriture.
// 2. Rend la boutique du mode cuisine apte à prendre des commandes à toute heure.
// 3. Ouvre une session de mode test par rôle, par l'API (aucun navigateur), enregistrée dans
//    playwright/.auth/<rôle>.json. Ce dossier doit être dans .gitignore : jeton signé valable 8 heures.
import { test as setup, expect } from "@playwright/test";
import { assertDisposableDatabase } from "./support/db";
import { prepareKitchenShop } from "./support/data";

const ROLES = ["CLIENT", "BOUCHER", "ADMIN"] as const;

setup("base jetable et boutique du mode cuisine prête", async () => {
  assertDisposableDatabase();
  await prepareKitchenShop();
});

for (const role of ROLES) {
  setup(`session de test ${role}`, async ({ request }) => {
    const secret = process.env.TEST_SECRET ?? "";
    expect(
      secret.length,
      "TEST_SECRET (16 caractères au moins) doit être défini pour le serveur ET pour Playwright",
    ).toBeGreaterThanOrEqual(16);

    const response = await request.post("/api/test-mode/activate", { data: { secret, role } });
    expect(
      response.status(),
      "mode test refusé : vérifier TEST_MODE, ALLOW_TEST_IN_PROD et TEST_SECRET côté serveur (429 = limite de débit Upstash)",
    ).toBe(200);

    await request.storageState({ path: `playwright/.auth/${role.toLowerCase()}.json` });
  });
}
