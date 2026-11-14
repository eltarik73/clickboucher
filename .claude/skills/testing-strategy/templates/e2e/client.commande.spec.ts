// Destination : tests/e2e/client.commande.spec.ts — scénario E2 (references/scenarios-e2e.md).
//
// ÉTAT AU 2026-11-14 : typé (tsc) et listé par Playwright (projets `desktop` et `mobile`).
// PAS encore exécuté contre l'application (next build / next start interdits pendant la rédaction).
// Chaque libellé vient du code : src/app/(client)/panier/page.tsx, src/components/checkout/OrderCountdown.tsx,
// src/app/(client)/suivi/[id]/SuiviClient.tsx.
//
// Avec une session de test CLIENT, useCheckoutSession() voit le visiteur « connecté » (cookie indice
// klikgo-test-activated) : le panier poste vers /api/orders au nom de TEST_USERS.CLIENT (Amina Test,
// créée au premier appel par getOrCreateUser). Le parcours INVITÉ par l'écran exige au contraire
// qu'aucune session de test ne soit ouverte et que clerk-js se charge : voir points-a-arbitrer.md, A2.
import { test, expect, AUTH } from "./fixtures/test";
import { kitchenShop, makeProduct } from "./support/data";
import { prisma } from "./support/db";
import { TEST_USERS } from "@/lib/auth/test-auth";

test.use({ storageState: AUTH.client });

test("le client confirme son panier, le total est celui du serveur, il arrive sur le suivi", async ({ page, seedCart }) => {
  // Arrange — un produit au prix connu, déjà dans le panier (l'ajout au panier est le scénario E1).
  const shop = await kitchenShop();
  const product = await makeProduct(shop.id, { priceCents: 1290 });
  await seedCart({
    shopId: shop.id,
    shopName: shop.name,
    shopSlug: shop.slug,
    items: [{ id: product.id, productId: product.id, name: product.name, imageUrl: "", unit: "PIECE", priceCents: 1290, quantity: 2 }],
  });

  // Act
  await page.goto("/panier");
  await expect(page.getByRole("heading", { name: "Finaliser la commande" })).toBeVisible();
  // Le montant figure sur la ligne, au sous-total et au total : « au moins un visible » est l'idiome
  // documenté de `.first()).toBeVisible()` (seul usage admis de first() ; l'audit ne le signale pas).
  await expect(page.getByText("25,80 €").first()).toBeVisible();
  // Le bouton reste désactivé tant que le devis du serveur n'est pas arrivé : le clic l'attend.
  await page.getByRole("button", { name: "Confirmer ma commande" }).click();
  await expect(page.getByRole("dialog", { name: "Confirmation de commande" })).toBeVisible();

  // Assert — compte à rebours annulable (5 s) puis écran de succès (2 s) : on attend l'effet, pas la durée.
  await page.waitForURL(/\/suivi\/[^/?]+$/, { timeout: 15_000 });
  const orderId = new URL(page.url()).pathname.split("/").pop() as string;

  // Postcondition en base : prix serveur, commande en attente du boucher, une seule ligne créée.
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true } });
  expect(order).toMatchObject({ shopId: shop.id, status: "PENDING", totalCents: 2580 });
  expect(order.user.clerkId).toBe(TEST_USERS.CLIENT.clerkId);
});

test("annuler pendant le compte à rebours : aucune commande n'est créée", async ({ page, seedCart }) => {
  const shop = await kitchenShop();
  const product = await makeProduct(shop.id);
  await seedCart({
    shopId: shop.id,
    shopName: shop.name,
    shopSlug: shop.slug,
    items: [{ id: product.id, productId: product.id, name: product.name, imageUrl: "", unit: "PIECE", priceCents: 1000, quantity: 1 }],
  });

  await page.goto("/panier");
  await page.getByRole("button", { name: "Confirmer ma commande" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirmation de commande" });
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click(); // OrderCountdown.tsx, pendant les 5 s

  await expect(dialog).toBeHidden();
  expect(await prisma.orderItem.count({ where: { productId: product.id } })).toBe(0);
});
