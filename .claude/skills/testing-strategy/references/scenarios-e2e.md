# Les dix premiers parcours de bout en bout

Ordre = ordre d'écriture. Chaque parcours suit les règles de [playwright-e2e.md](playwright-e2e.md) : données propres et uniques, montants venus du serveur, attente de l'effet, vérification à l'écran **et** en base. Libellés relevés dans le code le 2026-11-14 ; les relire avant d'écrire la spec.

Aucun de ces parcours n'a encore tourné contre l'application : ce sont des spécifications tirées de la lecture du code, les deux gabarits compris. Le nom du fichier choisit le projet ([playwright-e2e.md](playwright-e2e.md) §3) : `client.<sujet>.spec.ts`, `cuisine.<sujet>.spec.ts`, `admin.<sujet>.spec.ts`, `smoke.spec.ts`.

Légende de l'état : **prêt** = faisable avec le code actuel, à écrire ; **T12** = attend l'ajout d'un nom accessible au produit (à faire dans le même commit) ; **A2** = attend une décision sur Clerk en test ([points-a-arbitrer.md](points-a-arbitrer.md)).

| # | Parcours | Projet(s) | Session | État |
|---|---|---|---|---|
| E1 | Découvrir, choisir un produit au poids, le retrouver au panier | `mobile`, `desktop` | aucune | prêt |
| E2 | Confirmer un panier, total serveur, arrivée sur le suivi | `mobile`, `desktop` | CLIENT | prêt — gabarit `client.commande.spec.ts` |
| E3 | Prix modifié entre le devis et la confirmation | `mobile` | CLIENT | prêt |
| E4 | Commande programmée sur un créneau, bandeau en cuisine | `mobile` + `tablette-cuisine` | CLIENT puis BOUCHER | T12 |
| E5 | Nouvelle commande en cuisine, acceptation, le client le voit | `tablette-cuisine` | BOUCHER + second contexte | T12 — gabarit `cuisine.accepter.spec.ts` |
| E6 | Refus avec motif, le client voit le refus | `tablette-cuisine` | BOUCHER + second contexte | T12 |
| E7 | Préparer → Prête → Récupérée | `tablette-cuisine` | BOUCHER | T12 |
| E8 | Le client annule sa commande en attente | `mobile` | CLIENT | prêt |
| E9 | Sans session : pages et API protégées refusées | `desktop` | aucune | prêt, à confirmer avec les clés Clerk factices |
| E10 | Pages publiques : réponse, titre, accessibilité, zéro appel API | `lecture-seule` | aucune | prêt (axe : A1) |

Déjà couvert plus bas, donc **pas** en bout de bout : calculs de prix et de remises (`src/lib/__tests__/pricing-*`), courses accepter / annuler / expirer (`tests/integration/orders/transition-races.test.ts`), isolation entre boutiques (intégration, Clerk simulé), idempotence de création (`create-order-concurrency.test.ts`), polling du mode cuisine (`use-order-polling.test.ts`).

---

### E1 — Découvrir et remplir le panier (anonyme)

- **Préparation** : `makeProduct((await kitchenShop()).id, { unit: "KG", priceCents: 1990 })` au nom unique.
- **Étapes** : `/` → lien de la ville (Chambéry) → carte de la boutique → produit → choisir un poids → ajouter → `/panier`.
- **Vérifier** : la ligne porte le nom unique et le poids choisi ; le badge du panier compte 1 ; **aucune requête `/api/*` au montage** de l'accueil, de la page ville et de la page boutique, c'est-à-dire avant toute interaction (règle de coût CPU de CLAUDE.md, extrait en [playwright-e2e.md](playwright-e2e.md) §11) ; aucune exception JavaScript (fixture `pageErrors`).
- **Attendu après l'ajout, donc hors de l'assertion** : `POST /api/cart` deux secondes après l'ajout tant que Clerk n'a pas fini de charger (`use-cart.tsx` ; avec les clés factices de la CI il ne charge jamais), et `POST /api/orders/quote` sur `/panier`.
- **Piège** : `/boutique/[slug]` est volontairement dynamique (données live) ; l'accueil et la ville sont prérendus. Le produit créé après le build n'apparaît pas sur une page ISR avant revalidation : passer par la page boutique.

### E2 — Confirmer le panier (client)

- **Gabarit** : `templates/e2e/client.commande.spec.ts` (deux tests : confirmation, annulation pendant le compte à rebours).
- **Vérifier** : « Total à payer » affiche le devis serveur (25,80 € pour 2 × 12,90 €) ; dialogue « Confirmation de commande » ; redirection `/suivi/<id>` en moins de 15 s (5 s de compte à rebours + 2 s, T13) ; en base `status: "PENDING"`, `totalCents: 2580`, utilisateur `TEST_USERS.CLIENT` (`src/lib/auth/test-auth.ts`).
- **Variante invité par l'écran** (formulaire « Email * », « Prénom * », « Nom * », message « Prénom requis ») : sans session de test, `/panier` attend clerk-js (T18) — A2.

### E3 — Le prix change entre le devis et la confirmation

- **Préparation** : panier semé (`seedCart`) avec un produit à 10,00 € ; ouvrir `/panier`, attendre « 10,00 € ».
- **Agir** : `prisma.product.update({ priceCents: 1200 })`, puis « Confirmer ma commande ».
- **Vérifier** : le serveur répond 409 `PRICE_CHANGED` (`waitForResponse` sur `/api/orders`) ; le dialogue se ferme ; le message de prix modifié s'affiche ; le nouveau total (12,00 €) est proposé ; **aucune** ligne `OrderItem` pour ce produit. Le second clic sur « Confirmer » crée bien la commande à 12,00 €.
- **Pourquoi en bout de bout** : la logique est testée en intégration (`checkout-contract.test.ts`), mais seul le navigateur prouve que l'écran relit le devis et ne crée rien en silence.

### E4 — Commande programmée

- **Préparation** : la date du créneau est **demain** (loin de la marge de 10 min et des heures de fermeture), choisie dans la liste que renvoie `GET /api/shops/[id]/available-slots?date=…` ; si la liste est vide, prendre le jour ouvert suivant (`getDayHours` de `src/lib/shop-hours.ts`).
- **Étapes client** : `/panier` → « Choisir un créneau » → date et créneau → confirmer.
- **Vérifier** : en base `pickupSlotStart` = créneau choisi (UTC correspondant à l'heure de Paris) ; côté cuisine (second contexte BOUCHER) la carte du client porte « PROGRAMMEE — Retrait a HH:MM ».
- **Ne pas** tester la bascule « 30 min avant » ici : elle dépend de l'heure du serveur, que `page.clock` ne pilote pas `[PW5]` ; elle relève de `order-lifecycle-realtime` (tests du hook et du service avec `now`).

### E5 — Accepter en cuisine (le parcours de référence)

- **Gabarit** : `templates/e2e/cuisine.accepter.spec.ts`.
- **Préparation** : `placeGuestOrder(page.request, …)` (devis puis `/api/checkout/guest`), client `Zoe<uid>.T`.
- **Étapes** : `/boucher/commandes` → carte du client (sonde 5 s : `timeout: 15_000`) → « VOIR » → « Accepter » → « Délai de préparation en minutes » = 20 → « CONFIRMER ».
- **Vérifier** : `PATCH /api/boucher/orders/<id>/action` = 200 ; bouton « Prete » visible ; en base `ACCEPTED` ; dans un second contexte CLIENT, le suivi de l'invité montre l'étape courante « Acceptée ».
- **T12** : `role="article"` + `aria-label` sur la carte ; frise du suivi en `<ol>` / `<li>`, `aria-current="step"` sur l'étape courante (le gabarit l'affirme par `getByRole("listitem")` + `toHaveAttribute`).

### E6 — Refuser avec un motif

- **Étapes** : carte → « Refuser » → motif « Rupture de stock » → « Confirmer le refus ».
- **Vérifier** : en base `DENIED`, `denyReason` enregistré, un seul `OrderEvent` de refus ; la carte quitte « Nouvelles » ; le suivi client affiche le refus. Pour un produit anti-gaspi, le stock réservé n'a pas bougé (refus depuis PENDING).

### E7 — Préparer, prête, récupérée

- **Préparation** : commande invité **acceptée par l'API** (`PATCH …/action { action: "accept", estimatedMinutes: 15 }` depuis le contexte BOUCHER) : l'acceptation est le sujet de E5, pas d'ici.
- **Étapes** : « Preparer » → « Prete » → (colonne Prêtes) « Recuperee ».
- **Vérifier** : statuts successifs en base `PREPARING`, `READY`, `PICKED_UP` ; trois `OrderEvent` ; la carte passe de colonne sans rechargement ; le suivi client affiche « Retirée ».
- **Tablette** : projet `tablette-cuisine`, interactions tactiles (`hasTouch`). La cible de 44 px (CLAUDE.md) se mesure par `boundingBox()`, mais l'audit de `accessibility-wcag` relève déjà des boutons de `KitchenOrderCard` sous ce seuil : ajouter l'assertion avec la correction du composant, pas avant (elle serait rouge dès le premier jour).

### E8 — Le client annule

- **Préparation** : commande du client de test créée par l'API (`/api/orders/quote` puis `/api/orders` depuis le contexte CLIENT).
- **Étapes** : `/commande/<id>` → « Annuler la commande » → confirmer si demandé.
- **Vérifier** : en base `CANCELLED` ; la commande n'apparaît plus dans « Nouvelles » côté cuisine. Le cas « acceptée depuis plus de 5 minutes, annulation refusée » relève de l'intégration (`commands-customer.test.ts`, `isCancellable`) : ne pas attendre 5 minutes dans un navigateur.

### E9 — Sans session, rien ne s'ouvre

- **Étapes** (contexte vierge) : `/boucher/commandes`, `/admin`, `/webmaster` ; `PATCH /api/boucher/orders/<id>/action` par `request`.
- **Vérifier** : redirections du middleware (`/espace-boucher`, `/admin-login`) ; l'API répond 401 ; le suivi d'une commande invité sans `guestToken` ne montre pas la commande.
- **À confirmer au premier lancement** : sans jeton de test, le middleware appelle `clerkMiddleware` avec les clés factices de la CI ; si Clerk refuse de démarrer, ce parcours ne tourne qu'avec une instance Clerk de développement (A2).

### E10 — Pages publiques (lecture seule)

- **Pages** : `/`, `/boucherie-halal/chambery`, `/boutique/el-fathe` (slug du seed — pas `boucherie-tarik`, absent), `/cgv`, `/a-propos`, `/sitemap.xml`, `/robots.txt`, `/api/health`.
- **Vérifier** : 200 partout ; pour les pages HTML, `<title>` au format `… | Klik&Go`, un seul `h1`, balise canonique sur `https://klikandgo.app` (valeur de `NEXT_PUBLIC_SITE_URL`, y compris en local et en CI) ; scan axe sans violation `serious` ou `critical` (méthode : `accessibility-wcag`) ; zéro appel `/api/*` au montage (§11 de playwright-e2e.md).
- **Remplace** le contenu de `tests/e2e/smoke.spec.ts` (sélecteurs CSS, slug absent du seed) en gardant ce nom de fichier : c'est lui que le projet `lecture-seule` reconnaît. Ne contrôle **pas** l'indexation ni les données structurées : règles du skill `seo-anti-penalty`, contrôlées par `scripts/check-prerender.mjs` et le cron d'audit SEO.
