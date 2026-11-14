# Playwright — parcours de bout en bout

Version installée : `@playwright/test` 1.59.1 ; chaque API citée a été retrouvée dans ses types `[L9]`. La documentation en ligne décrit la dernière version : en cas de doute, `node_modules/playwright/types/test.d.ts` fait foi. Gabarits : `templates/e2e/` (typés, listés — 9 tests — et sans alerte de l'audit le 2026-11-14 `[L24][L29]`, **pas encore exécutés contre l'application** : `next build` / `next start` étaient interdits pendant la rédaction et la vérification). Le premier lancement réel fait partie du travail : tout écart constaté se corrige dans le gabarit. Les dix scénarios : [scenarios-e2e.md](scenarios-e2e.md).

## 1. À quoi servent nos parcours

Peu de parcours, à forte valeur, qui traversent ce que les niveaux inférieurs ne voient pas : hydratation, middleware, cookies, session de test, sonde du mode cuisine, redirections `[MF2][KCD2]`. Un défaut trouvé par un parcours reçoit aussi un test plus bas (unitaire ou intégration) `[MF2]`. Un parcours ne revérifie pas un calcul de prix : il vérifie que le prix du serveur arrive à l'écran et en base.

## 2. Contre quoi on lance

| Cible | Projets | Pourquoi |
|---|---|---|
| Serveur local : `npm run build` puis `next start`, base locale jetable remplie par le seed, mode test actif | tous | Next recommande de tester le code de production `[NX2]` ; seul endroit où l'on peut écrire. |
| Recette en ligne — **aucune aujourd'hui** : l'environnement Preview de Vercel n'a pas de base et les branches `claude/**` et `dependabot/**` ne se déploient pas (CLAUDE.md, « Vercel preview ») | `lecture-seule` | Le jour où l'owner crée une recette (base dédiée) : pages publiques et a11y seulement. Chaque vue coûte du CPU Vercel. |
| Production | **aucun** | Le mode test y est impossible (`test-mode-env.ts`) ; une écriture y serait une vraie commande ; coût CPU (panne du 2026-11-05). La sonde d'uptime (`.github/workflows/uptime.yml`) couvre la disponibilité. Le gabarit lève une erreur si `PLAYWRIGHT_BASE_URL` vise `klikandgo.app` `[L29]`. |

La configuration du gabarit dérive tout de `PLAYWRIGHT_BASE_URL` : hors `localhost`, seul le projet `lecture-seule` existe et aucun `webServer` n'est lancé. **Tant que le gabarit n'a pas remplacé `playwright.config.ts`, `npm run test:e2e` sans variable vise la production (T3) : ne pas le lancer.**

### Préparer un lancement local

```bash
# 1. Base jetable (nom en *_e2e : assertDisposableDatabase refuse la base de développement)
docker run -d --name klikgo-e2e -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=klikgo_e2e \
  -p 127.0.0.1:55434:5432 postgres:16-alpine
export DATABASE_URL="postgresql://ci:ci@127.0.0.1:55434/klikgo_e2e?schema=public"
export DIRECT_DATABASE_URL="$DATABASE_URL"    # sur sa propre ligne : `export A=… B="$A"` donnerait à B l'ANCIENNE valeur de A,
                                              # et `db push` (qui lit DIRECT_DATABASE_URL) viserait une autre base
npx prisma db push --skip-generate && npx prisma db seed     # db push : voir T11 / A5 ; le seed vide la base visée (T8)
# 2. Build de production sur cette base (≈ 290 pages prérendues l'interrogent)
npm run build
# 3. Navigateur de la version installée (la 1.59.1 attend Chromium révision 1217 ; une révision plus ancienne en cache ne suffit pas [L9])
npx playwright install chromium
# 4. Secret de session de test : jamais dans un fichier suivi
export TEST_SECRET="$(openssl rand -hex 24)"
npx playwright test                       # = npm run test:e2e ; webServer lance `npm run start` avec TEST_MODE et ALLOW_TEST_IN_PROD
npx playwright test --project=tablette-cuisine --headed   # un projet, à l'écran
npx playwright show-report
```

## 3. Configuration (`templates/e2e/playwright.config.ts`)

| Réglage | Valeur | Raison |
|---|---|---|
| `baseURL` | `PLAYWRIGHT_BASE_URL` ou `http://localhost:3000` ; erreur si l'hôte est `klikandgo.app` | Jamais la production, ni par défaut (T3) ni par variable (règle 9). |
| `webServer` | `npm run start`, prêt sur `/api/health`, `reuseExistingServer: !CI`, 120 s | `[PW3]` ; `env` s'ajoute à `process.env` : `PORT` (celui de `baseURL`), `TEST_MODE`, `ALLOW_TEST_IN_PROD` (car `next start` = `NODE_ENV=production`), variables Upstash vides (ni limite de débit ni cache partagé pendant les parcours, T10). |
| `workers` | 1 en CI | Recommandé par Playwright pour la reproductibilité `[PW8]`, et une seule boutique pour le rôle BOUCHER (§4). |
| `retries` / `failOnFlakyTests` | 1 / vrai en CI | Le ré-essai produit la trace et classe le test « flaky » ; il ne le sauve pas `[PW6][PW16]`. |
| `trace` | `on-first-retry` | `[PW1][PW25]` : la trace plutôt que la vidéo. |
| `locale`, `timezoneId` | `fr-FR`, `Europe/Paris` | N'agit que sur le navigateur, pas sur le serveur `[PW11]`. |
| `serviceWorkers` | `block` | La PWA enregistre un service worker : hors sujet et source d'écarts `[PW26]`. |
| `forbidOnly` | vrai en CI | Un `.only` oublié ne doit pas réduire la suite. |
| Projets | `setup` → `desktop`, `mobile` (375 × 812), `tablette-cuisine` (`Galaxy Tab S4 landscape`, 1138 × 712, tactile) ; `lecture-seule` | **Le préfixe du fichier choisit le projet** : `client.<sujet>.spec.ts` → `desktop` + `mobile` ; `boucher.…` et `admin.…` → `desktop` ; `cuisine.…` → `tablette-cuisine` ; `smoke.spec.ts` et `a11y.spec.ts` → `lecture-seule`. Un fichier nommé autrement n'est lancé par aucun projet. Dépendances de projets plutôt que `globalSetup` : visibles et tracées `[PW13][PW24]`. Largeur de référence du produit 375 px (CLAUDE.md) ; le `viewport` se surcharge après le descripteur `[PW11]`. Tablette en paysage : au-dessus du seuil `lg` des trois colonnes du mode cuisine. |

Chromium seul : n'installer que les navigateurs utiles `[PW1]` (`npx playwright install --with-deps chromium`). Un projet WebKit (`iPad Mini landscape`, 1024 × 768) s'ajoute le jour où un défaut propre à Safari apparaît.

## 4. Sessions : le mode test

Le serveur ne croit que le jeton signé de `klikgo-test-session` ([etat-des-lieux.md](etat-des-lieux.md) §5). Le projet `setup` (`templates/e2e/auth.setup.ts`) l'obtient par l'API et l'enregistre, comme le recommande Playwright pour une application dotée d'une route de connexion `[PW2]` :

```ts
const response = await request.post("/api/test-mode/activate", { data: { secret, role } });
await request.storageState({ path: `playwright/.auth/${role.toLowerCase()}.json` });
```

- Une spec choisit son rôle par `test.use({ storageState: AUTH.boucher })`.
- **Deux rôles dans un test** (boucher accepte, client voit) : un second `BrowserContext` avec l'autre fichier `[PW2]` — voir `cuisine.accepter.spec.ts`.
- `playwright/.auth/` va dans `.gitignore` (T17) : le fichier permet d'agir avec le rôle pendant 8 h `[PW2]`.
- `sessionStorage` n'est pas conservé par `storageState` `[PW2]` : panier et `audioUnlocked` se posent par `addInitScript` (fixtures).
- Le rôle BOUCHER agit toujours sur la plus ancienne boutique (« El Fathe ») : une boutique pour tous les parcours cuisine, d'où `workers: 1` et des noms de client uniques. Un compte par worker, recommandé par Playwright quand les tests modifient un état serveur partagé `[PW2]`, demanderait de choisir la boutique dans le jeton (A3).
- Le parcours invité **par l'écran** exige qu'aucune session de test ne soit ouverte et que clerk-js se charge (T18) : clés d'une vraie instance Clerk de développement et `@clerk/testing` `[CK2][CK3]` (A2).

## 5. Données d'un parcours (`templates/e2e/support/`)

1. **Par l'API quand elle existe** : elle exerce le code de production `[PW18]`. `placeGuestOrder()` demande le devis (`POST /api/orders/quote`) puis poste `/api/checkout/guest` avec `expectedTotalCents` = total du devis et une `idempotencyKey` neuve.
2. **Par Prisma sinon** (`support/db.ts`), après `assertDisposableDatabase()` : hôte local **et** base `ci`, `*_test` ou `*_e2e`. Ne pas importer `tests/integration/helpers/*` (ils importent Vitest).
3. **Suffixe aléatoire** sur tout ce qui est unique ou sert à retrouver un élément : la base n'est pas vidée entre deux parcours `[PW14][GY1]`.
4. **Ne rien lire du seed qui soit aléatoire** (prix, ruptures, promotions : T8). Un parcours crée son produit (`makeProduct`) au prix connu.
5. `prepareKitchenShop()` (projet `setup`) remet la boutique cuisine `OPEN` et relève ses plafonds (25 commandes par heure dans le seed).

## 6. Fixtures ou objets de page ?

Les objets de page sont « une approche » pour structurer une suite, pas une obligation `[PW9]` ; les fixtures regroupent préparation et nettoyage et se composent `[PW10]`.

Décision pour Klik&Go : **fixtures + fonctions d'aide, pas d'objet de page au départ.** `templates/e2e/fixtures/test.ts` fournit `seedCart`, l'écartement des bandeaux (consentement, invite PWA, déblocage du son) et `pageErrors` (toute exception JavaScript fait échouer le test). Un objet de page n'est créé que lorsque **trois specs** répètent les mêmes locators sur un écran ; il est alors fourni comme fixture, et n'expose que des actions métier (`accepter(commande, minutes)`), jamais des sélecteurs. Le premier candidat est le mode cuisine (E5 à E7).

## 7. Locators

- Ordre : `getByRole` (avec `name`), `getByLabel`, `getByText`, puis `getByTestId` ; ni CSS ni XPath ; `first()` / `nth()` déconseillés `[PW12][TL1]`. Seule exception : `await expect(locator.first()).toBeVisible()`, l'idiome que la documentation de `toBeVisible` donne pour « au moins un élément visible » (types de la 1.59.1) — l'audit ne le signale pas. Un état porté par un attribut se vérifie par `toHaveAttribute` sur un locator par rôle, pas par un sélecteur d'attribut.
- Les libellés se **lisent dans le code**, ils ne se devinent pas : l'interface cuisine écrit « Prete », « Preparer », « Recuperee » sans accent ; le suivi « Commande reçue », « Acceptée ».
- Une carte se retrouve **par le nom unique de son client** (`Zoe1a2b3c.T`), jamais par sa position.
- Ce qui n'est pas adressable se corrige dans le produit, avec le premier parcours qui en a besoin (T12) : `role="article"` + `aria-label` sur `KitchenOrderCard`, `<label>` sur les champs invité, frise du suivi en `<ol>` / `<li>` avec `aria-current="step"` sur l'étape courante. C'est aussi une correction d'accessibilité (`accessibility-wcag`).

## 8. Stabilité

| Faire | Ne pas faire | Pourquoi |
|---|---|---|
| `await expect(locator).toBeVisible()` (assertion qui réessaie) | `expect(await locator.isVisible()).toBe(true)` | Seule la première réessaie `[PW1][PW20]`. |
| Attendre l'effet : `waitForURL`, `waitForResponse` sur la route, délai explicite (`{ timeout: 15_000 }` pour la sonde cuisine de 5 s, T13 pour la confirmation) | `page.waitForTimeout(…)` | « Never use bare sleeps » `[MF1]` ; le script d'audit en fait une erreur. |
| `page.clock.setFixedTime(...)` pour un affichage dépendant de l'heure **dans le navigateur** | Croire que l'horloge du serveur suit | `page.clock` remplace les horloges globales de la page (`Date`, minuteurs…) `[PW5]` ; rien ne touche le processus `next start` : les créneaux et l'expiration sont calculés par le serveur à l'heure réelle. Choisir des dates loin des seuils (créneau de demain). |
| `page.route` pour un tiers (Plausible, images Replicate) | Appeler un service externe | « Only test what you control » `[PW1][PW15]`. |
| Lint `@typescript-eslint/no-floating-promises` sur `tests/**` | Laisser un `await` manquer | Un `expect` non attendu ne vérifie rien `[PW1]` (T14, A10). |

**Test instable** : il n'est ni ré-essayé en boucle ni ignoré en silence. Quarantaine (`test.fixme` + annotation `{ type: "issue", description: <lien> }`) **datée et plafonnée** `[MF1][PW22]` : Fowler donne en exemple 8 tests et une semaine ; pour une suite de dix parcours et une personne, nous fixons 2 tests et 14 jours. Chaque test suspendu a un propriétaire et un ticket `[SL1]`. Chez Uber, un test sous 90 % de réussite par tentative devient non bloquant et part en ticket à l'équipe propriétaire `[UB1]` : nous n'avons pas le volume pour mesurer un taux, d'où la règle simple ci-dessus.

## 9. Vérifications visuelles

- **Structure d'abord** : `toMatchAriaSnapshot` (arbre d'accessibilité, correspondance partielle) résiste aux changements de style et documente les rôles `[PW17]`. À préférer pour « la carte cuisine contient numéro, client, articles, boutons ».
- **Capture d'écran** (`toHaveScreenshot`) seulement pour un rendu où la mise en page est le sujet : ticket 80 mm, carte cuisine, panier à 375 px en clair et en sombre (`colorScheme`). Les références se génèrent **dans l'environnement qui les compare** (Linux de la CI), car le nom porte le navigateur et la plate-forme `[PW4]` ; masquer heures et durées (`mask`), figer l'heure de la page `[PW5]`. Pas plus de cinq captures : chacune se met à jour à la main à chaque retouche visuelle.

## 10. Accessibilité

Méthode, règles axe et gabarits : skill `accessibility-wcag`, `references/tests-playwright-axe.md`. Ici seulement : le scan axe tourne dans E10 (pages publiques, projet `lecture-seule`) et à la fin de E2 et E5 ; `@axe-core/playwright` n'est pas installé (A1) ; un scan automatique ne remplace pas l'essai au clavier et au lecteur d'écran `[PW21]`.

## 11. Coût CPU : ce qu'un parcours peut vérifier

CLAUDE.md interdit tout appel API au montage pour un visiteur anonyme. Un parcours anonyme (E1) l'affirme :

```ts
// tests/e2e/client.decouvrir.spec.ts (extrait) — typé [L29], pas encore exécuté contre l'application
import { test, expect } from "./fixtures/test";

test("page ville : aucun appel à notre API au montage", async ({ page, baseURL }) => {
  const origin = new URL(baseURL as string).origin;
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Notre API seulement : un tiers (Plausible poste sur /api/event de son domaine) n'est pas le sujet.
    if (url.origin === origin && url.pathname.startsWith("/api/")) apiCalls.push(url.pathname);
  });
  await page.goto("/boucherie-halal/chambery");
  // « networkidle » est déconseillé pour attendre un élément ; ici on prouve une ABSENCE de requête,
  // il faut donc laisser la page se calmer. Seul usage admis dans la suite.
  await page.waitForLoadState("networkidle");
  expect(apiCalls).toEqual([]); // liste blanche explicite si une page publique en a vraiment besoin
});
```
