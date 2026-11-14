// Destination : tests/e2e/cuisine.accepter.spec.ts — scénario E5 (references/scenarios-e2e.md).
//
// ÉTAT AU 2026-11-14 : typé (tsc) et listé par Playwright dans le projet `tablette-cuisine`.
// PAS encore exécuté contre l'application. Les libellés « VOIR », « Accepter », « CONFIRMER », « Prete »
// et « Délai de préparation en minutes » sont lus dans src/components/boucher/KitchenOrderCard.tsx.
// Deux ajouts au produit sont nécessaires, à faire dans le premier commit du parcours (écart T12 de references/etat-des-lieux.md) :
//  (*1) racine de KitchenOrderCard : role="article" et aria-label nommant la commande et le client
//       (par exemple `Commande #012 Zoe1a2b3c.T`) — aujourd'hui un <div> sans rôle ni nom ;
//  (*2) frise de suivi (SuiviClient.tsx) : une liste ordonnée (<ol> / <li>) dont l'étape courante porte
//       aria-current="step" — aujourd'hui des <div>, l'étape courante n'est signalée que par une couleur
//       et un émoji.
// Les deux sont des corrections d'accessibilité (skill accessibility-wcag) autant que des contrats de test.
import { test, expect, AUTH } from "./fixtures/test";
import { kitchenShop, makeProduct, placeGuestOrder } from "./support/data";
import { prisma } from "./support/db";

test.use({ storageState: AUTH.boucher });

test("une nouvelle commande arrive en cuisine, le boucher l'accepte, le client le voit", async ({ page, browser }) => {
  // Arrange — la commande passe par la route du parcours invité ; l'écran panier est couvert ailleurs.
  const shop = await kitchenShop();
  const product = await makeProduct(shop.id);
  const order = await placeGuestOrder(page.request, { shopId: shop.id, items: [{ productId: product.id, quantity: 2 }] });

  // Act — la carte se retrouve par le nom unique du client, jamais par sa position ni par un compteur.
  await page.goto("/boucher/commandes");
  const card = page.getByRole("article", { name: new RegExp(order.customer) }); // (*1)
  await expect(card).toBeVisible({ timeout: 15_000 }); // la sonde interroge le serveur toutes les 5 s
  await card.getByRole("button", { name: "VOIR" }).click(); // une commande PENDING arrive en vue compacte
  await card.getByRole("button", { name: "Accepter" }).click();
  await card.getByLabel("Délai de préparation en minutes").fill("20");
  const action = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/boucher/orders/${order.orderId}/action`,
  );
  await card.getByRole("button", { name: "CONFIRMER" }).click();
  expect((await action).status()).toBe(200);

  // Assert — côté boucher : la commande est en cours, « Prete » devient une action disponible.
  // (L'interface cuisine écrit « Prete », « Preparer », « Recuperee » sans accent : relever les libellés, ne pas les deviner.)
  await expect(card.getByRole("button", { name: /^Prete/ })).toBeVisible();
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe("ACCEPTED");

  // Assert — côté client : un second contexte, sans la session du boucher, suit la commande.
  const customer = await browser.newContext({ storageState: AUTH.client });
  const tracking = await customer.newPage();
  await tracking.goto(order.trackingPath);
  await expect(tracking.getByRole("listitem").filter({ hasText: "Acceptée" })).toHaveAttribute("aria-current", "step"); // (*2)
  await customer.close();
});
