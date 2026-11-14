# Exemples — mauvais / bon, en Vitest, aux formes de Klik&Go

## Sommaire

1. Prix d'une portion (unitaire)
2. Route boucher : la commande d'une autre boutique (intégration)
3. Notification (intégration)
4. Composant (Testing Library)
5. Erreur attendue
6. Un test devient rouge : trancher
7. Table de mutations à joindre au rapport

Code écrit pour ce skill, aux formes du dépôt ; les fichiers cités comme modèles existent. Les
valeurs ont été calculées à la main puis contrôlées une fois contre `src/lib/pricing/line.ts`.

## 1. Prix d'une portion (unitaire)

Régression visée : la règle de `CLAUDE.md` « prix d'une portion = floor((prix au kg × grammes + 500) / 1000) ; N portions = N × ce prix ».

```ts
// Mauvais : l'attendu sort du code testé ; le test passe quelle que soit la formule.
it("calcule le prix", () => {
  const expected = portionPriceCents(2490, 350);
  expect(lineTotalCents({ unit: "KG", quantity: 1, weightGrams: 350 }, 2490)).toBe(expected);
});

// Mauvais aussi : la formule recopiée reproduit le défaut du code au lieu de l'attraper.
expect(portionPriceCents(2490, 350)).toBe(Math.floor((2490 * 350 + 500) / 1000));
```

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { lineTotalCents, portionPriceCents } from "@/lib/pricing/line";

describe("portionPriceCents — 24,90 €/kg", () => {
  it.each([
    [350, 872], // 2 490 × 350 = 871 500 → 871,5 c, arrondi au-dessus
    [333, 829], // 2 490 × 333 = 829 170 → 829,17 c, arrondi au-dessous
  ])("%d g coûtent %d centimes", (grams, expected) => {
    expect(portionPriceCents(2490, grams)).toBe(expected);
  });
});

describe("lineTotalCents — portions identiques", () => {
  it("3 portions de 350 g coûtent 3 × 872 = 2 616, pas 2 615 (1 050 g pesés d'un coup)", () => {
    expect(lineTotalCents({ unit: "KG", quantity: 3, weightGrams: 350 }, 2490)).toBe(2616);
  });
});
```

Les bornes se figent par le comportement, pas par la valeur de la constante :
`checkLineQuantity({ unit: "KG", quantity: 100, weightGrams: 500 })` vaut `"QUANTITY_INVALID"`,
`checkLineQuantity({ unit: "KG", quantity: 1, weightGrams: 50_001 })` vaut `"WEIGHT_INVALID"`,
et 99 portions de 50 000 g passent. Modèle complet : `src/lib/__tests__/pricing-line.test.ts`.

## 2. Route boucher : la commande d'une autre boutique (intégration)

Régression visée : le filtre de boutique retiré de la recherche de la commande.

```ts
// Mauvais : Prisma simulé, assertion sur le mock. Vert même si la route ignore shopId :
// le mock renvoie ce qu'on lui a dit de renvoyer.
prismaMock.order.findFirst.mockResolvedValue(null);
const res = await PATCH(req, { params: { orderId: "o1" } });
expect(prismaMock.order.findFirst).toHaveBeenCalled();
```

```ts
// Bon : vrai handler, vraie base (schéma itest), données par les fabriques.
// pendingOrder, act, statusOf, signInAs : assistants du gabarit cité sous l'exemple.
it("le boucher d'une autre boutique : 404, statut inchangé, aucun OrderEvent", async () => {
  const { order } = await pendingOrder(); // boutique A, commande PENDING
  const intruder = await createTestUser({ role: "BOUCHER" });
  await createTestShop({ ownerId: intruder.id }); // boutique B
  signInAs(intruder);

  const res = await act(order.id, { action: "deny", reason: "Tentative inter-boutiques" });

  expect(res.status).toBe(404);
  expect(await statusOf(order.id)).toBe("PENDING");
  expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(0);
});
```

Les trois assertions comptent : le 404 seul ne prouve pas que rien n'a été écrit. Fichier complet,
avec 401 et 403 : `testing-strategy/templates/integration/api/boucher-isolation.test.ts` ;
variante sur la route réelle : `tests/integration/orders/commands-shop.test.ts`.

## 3. Notification (intégration)

Régression visée : la notification part au mauvais destinataire, ou sans le numéro de commande.

```ts
// Mauvais : prouve qu'un e-mail est parti, pas à qui ni pour quelle commande.
await sendNotification("ORDER_EXPIRED", data);
expect(sendEmail).toHaveBeenCalled();
```

```ts
// Bon : ligne en base relue, texte livré, contenu du transport.
// customer (avec pushSubscription), owner (propriétaire), order : créés par les fabriques ; seuls
// @/lib/email, @/lib/push et @/lib/whatsapp sont simulés.
const result = await sendNotification("ORDER_EXPIRED", {
  userId: customer.id,
  orderId: order.id,
  orderNumber: "KG26-000167",
  shopName: "Boucherie du Lac",
});

expect(result).toEqual({ sent: true, channels: ["email", "push"] });
const rows = await prisma.notification.findMany({ where: { userId: customer.id } });
expect(rows).toHaveLength(1);
expect(rows[0]).toMatchObject({ type: "ORDER_EXPIRED", orderId: order.id });
expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
  customer.email,
  "Commande KG26-000167 annulée",
  expect.stringContaining("Vous n'avez rien à payer")
);
expect(await prisma.notification.count({ where: { userId: owner.id } })).toBe(0);
```

Ici le texte est le livrable : le vérifier n'est pas un détecteur de changement. Modèle exécuté :
`tests/integration/notifications/order-notifications.test.ts`, bloc « événements ajoutés ».

## 4. Composant (Testing Library)

Régression visée : la confirmation ne déclenche pas l'action, ou déclenche aussi l'annulation.

```tsx
// Mauvais : sélecteur invisible pour l'utilisateur, attente avec effet de bord, rien de vérifié
// sur ce que le composant produit.
const { container } = render(
  <ConfirmDialog open title="Vider le panier ?" onConfirm={onConfirm} onOpenChange={() => {}} />
);
await waitFor(() => fireEvent.click(container.querySelector(".btn-danger")!));
expect(container.innerHTML).toMatchSnapshot();
```

```tsx
// Bon : rôle et nom accessibles, findBy pour l'apparition, sorties du composant vérifiées.
const calls: string[] = [];
render(
  <ConfirmDialog
    open
    title="Vider le panier ?"
    description="Tous les articles seront retirés."
    onOpenChange={(open) => calls.push(`open:${open}`)}
    onConfirm={() => calls.push("confirm")}
    onCancel={() => calls.push("cancel")}
  />
);
const alert = await screen.findByRole("alertdialog", { name: "Vider le panier ?" });
fireEvent.click(within(alert).getByRole("button", { name: "Confirmer" }));
expect(calls).toEqual(["confirm", "open:false"]);
```

Imports du dépôt : `render` de `@testing-library/react`, `fireEvent`, `screen`, `within` de
`@testing-library/dom`. Modèle : `tests/components/confirm-dialog.test.tsx`.

## 5. Erreur attendue

```ts
// Mauvais : si rien n'est levé, le test passe.
try {
  lineTotalCents({ unit: "KG", quantity: 100, weightGrams: 500 }, 2490);
} catch (error) {
  expect(error).toBeInstanceOf(RangeError);
}
```

```ts
// Bon : rouge si rien n'est levé.
expect(() => lineTotalCents({ unit: "KG", quantity: 100, weightGrams: 500 }, 2490)).toThrow(
  /QUANTITY_INVALID/
);
// Asynchrone (modèle : src/lib/__tests__/api-errors.test.ts, readJsonBody) :
await expect(readJsonBody(post("{bad"))).rejects.toBeInstanceOf(InvalidJsonBodyError);
```

`try/finally` reste admis pour restaurer un espion (même fichier).

## 6. Un test devient rouge : trancher

Situation : après une modification de `src/lib/pricing/line.ts`, le test de
`tests/integration/orders/quote.test.ts` « prices 500 g, 250 g, 2000 g and 2 × 500 g at 1911
cents/kg as 956, 478, 3822 and 1912 » échoue : reçu `[956, 478, 3822, 1911]`.

- Mauvais : remplacer 1912 par 1911 « pour coller au nouveau calcul ».
- Bon :
  1. Calcul à la main : 500 g à 19,11 €/kg = 955,5 → 956 ; 2 portions = 2 × 956 = 1 912.
  2. Source écrite : `CLAUDE.md` « N portions = N × ce prix ». 1 911 correspond à 1 000 g pesés
     d'un coup : le code a régressé.
  3. Corriger le code ; le test ne bouge pas. Le rapport cite l'échec, le calcul et la règle.
- Si la règle avait réellement changé (décision écrite du propriétaire, avec sa date) : nouvelle
  valeur recalculée à la main, changement de test dans une section à part du rapport.
  Sans décision écrite : `besoinsDuChef`, et le test reste tel quel.

## 7. Table de mutations à joindre au rapport

Exemple pour les tests du § 1 et du § 2 :

| Mutation                              | Test qui échoue                     | Réelle ou raisonnée |
| ------------------------------------- | ----------------------------------- | ------------------- |
| `+ 500` retiré de `portionPriceCents` | 350 g → 871 au lieu de 872          | réelle              |
| arrondi vers le haut (`Math.ceil`)    | 333 g → 830 au lieu de 829          | raisonnée           |
| prix calculé sur le poids total       | 3 × 350 g → 2 615 au lieu de 2 616  | raisonnée           |
| filtre de boutique retiré             | autre boutique → 200 au lieu de 404 | réelle              |
| `OrderEvent` écrit avant le contrôle  | `orderEvent.count` → 1 au lieu de 0 | raisonnée           |

Une mutation réelle se fait dans un fichier qu'on possède, se restaure, et le rapport cite la ligne
rouge puis la ligne verte (`verification-before-done` § 3).
