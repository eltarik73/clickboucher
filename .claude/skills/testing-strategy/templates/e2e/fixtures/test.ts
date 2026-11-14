// Destination : tests/e2e/fixtures/test.ts
// Les specs importent `test` et `expect` d'ici, jamais de "@playwright/test".
import { test as base, expect } from "@playwright/test";
// Type du panier lu par src/lib/hooks/use-cart.tsx : si le chantier change sa forme, tsc le signale ici.
import type { CartState } from "@/lib/cart/cart-line";

/** Fichiers de session écrits par auth.setup.ts. Usage : test.use({ storageState: AUTH.boucher }). */
export const AUTH = {
  client: "playwright/.auth/client.json",
  boucher: "playwright/.auth/boucher.json",
  admin: "playwright/.auth/admin.json",
} as const;

type Fixtures = {
  /** Pose un panier (clé sessionStorage "klikgo-cart") avant le premier script de la page. À appeler avant page.goto(). */
  seedCart: (cart: CartState) => Promise<void>;
  /** Exceptions JavaScript non rattrapées pendant le test. Vérifiées à la fin de chaque test. */
  pageErrors: string[];
};

export const test = base.extend<Fixtures>({
  // Ce qui recouvre l'écran ou bloque un parcours sans être le sujet du test.
  // sessionStorage n'est pas conservé par storageState : il se pose par script d'initialisation.
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("klikgo-analytics-consent", "refused"); // bandeau (src/components/AnalyticsConsent.tsx)
      window.localStorage.setItem("klikgo-pwa-dismiss", String(Date.now())); // invite d'installation (InstallPrompt.tsx)
      window.sessionStorage.setItem("audioUnlocked", "true"); // écran « ACTIVER LE SON » du mode cuisine
    });
    await use(page);
  },

  seedCart: async ({ page }, use) => {
    await use(async (cart) => {
      await page.addInitScript((value) => {
        // Ne pas écraser le panier que la page a modifié depuis (rechargement, navigation).
        // Le panier relu passe par normalizeStoredCart : les `id` de ligne sont recalculés.
        if (!window.sessionStorage.getItem("klikgo-cart")) {
          window.sessionStorage.setItem("klikgo-cart", JSON.stringify(value));
        }
      }, cart);
    });
  },

  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "exception JavaScript pendant le parcours").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
