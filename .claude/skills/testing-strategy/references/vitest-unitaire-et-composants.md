# Vitest — tests unitaires, hooks et composants

Version installée : Vitest 4.1.5 sur Vite 8.0.10 `[L9]`. La documentation à lire est `v4.vitest.dev` : `vitest.dev` décrit la version 5 `[VT1]`. Les extraits de code de ce fichier ont été exécutés sur l'arbre courant le 2026-11-14, puis une seconde fois par le vérificateur `[L21][L22][L28]`. Forme d'un handler : skill `api-route-conventions` (au 2026-11-14, son `references/tests-handlers.md` simule encore Prisma, ce que CLAUDE.md interdit — arbitrage A8 ; la forme sans Prisma est au §5). Tester sur une base réelle : [integration-postgres.md](integration-postgres.md).

## 1. Configuration : l'existant et la marche suivante

**Aujourd'hui** (`vitest.config.ts` du chantier 0) : deux projets `[VT2]`.

| Projet | Environnement | Fichiers | Commande |
|---|---|---|---|
| `unit` | `jsdom` par défaut ; `// @vitest-environment node` en tête de fichier pour s'en passer | `src/**/*.{test,spec}.{ts,tsx}`, `tests/**/*.test.{ts,tsx}` sauf `tests/integration/**` et `tests/components/FormWizard.test.tsx` (exclu) | `npx vitest run --project unit` |
| `integration` | `node` | `tests/integration/**/*.test.ts` | `npx vitest run --project integration` (base locale exigée) |

Règles valables dès maintenant :

- **Toujours nommer le projet.** Un `vitest run` nu lance les deux, donc exige une base. Les scripts npm le font déjà (`npm run test` = `unit`, `npm run test:integration`).
- **Tout test sans DOM commence par `// @vitest-environment node`** (règle de `CLAUDE.md`). Sans ce commentaire le fichier paie la mise en place de jsdom et peut s'appuyer sur `window` par accident `[VT8]`.
- En Vitest 4 un projet n'hérite de la racine que s'il porte `extends: true` `[VT2]` ; `coverage` et `reporters` ne se règlent qu'à la racine.

**Marche suivante (arbitrage A6)** : séparer `unit` en deux projets et réparer le JSX. Mesuré `[L4][L6][L21][L28]` : 3 fichiers seulement ont besoin d'un DOM ; la mise en place cumulée tombe sous 4 s ; les 6 tests de `FormWizard` passent avec la seule option `oxc`, sans rien installer ; la configuration ci-dessous, exécutée telle quelle, donne toute la suite `unit` plus les 6 tests de `FormWizard`, verts (43 fichiers, 914 tests à 08 h 27).

```ts
// vitest.config.ts — ce qui change par rapport à l'existant (le projet `integration` reste tel quel)
const DOM_TESTS = [
  "src/hooks/__tests__/**/*.test.{ts,tsx}",
  "src/lib/__tests__/visible-polling.test.ts",
  "src/**/*.dom.test.{ts,tsx}",
  "tests/components/**/*.test.tsx",
];
const IGNORED = ["node_modules", ".next", ".claude", "prisma/migrations"];

export default defineConfig({
  // tsconfig.json impose "jsx": "preserve" (Next) : sans ceci, Vite 8 ne transforme pas le JSX des tests.
  // `esbuild: { jsx: "automatic" }` est ignoré par Vite 8 ; `@vitejs/plugin-react` n'est pas nécessaire.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/{lib,services,api,security}/**/*.test.ts"],
          exclude: [...IGNORED, ...DOM_TESTS],
        },
      },
      {
        extends: true,
        test: { name: "dom", environment: "jsdom", setupFiles: ["./tests/setup.ts"], include: DOM_TESTS, exclude: IGNORED },
      },
      // … projet `integration` inchangé
    ],
  },
});
```

Les scripts nomment alors `--project unit --project dom`. Ne pas faire ce changement à moitié : le fichier appartient au chantier qui l'a ouvert, se coordonner avec lui.

## 2. Où poser le test

| Ce que tu testes | Fichier | Projet |
|---|---|---|
| Fonction pure de `src/lib/**` | `src/lib/__tests__/<module>.test.ts` | `unit` |
| Schéma Zod de `src/lib/validators` | `src/lib/__tests__/<sujet>.test.ts` (l'existant : `tests/lib/schemas.test.ts`, à compléter plutôt qu'à doubler) | `unit` |
| Règle de structure du code (qui écrit quoi, quelles routes passent le middleware) | un test qui lit les sources ; modèles : `src/lib/__tests__/middleware-matcher.test.ts`, `tests/lib/order-writers-guard.test.ts` | `unit` |
| Hook React | `src/hooks/__tests__/<hook>.test.ts` | `unit` aujourd'hui, `dom` demain |
| Composant client | `tests/components/<Composant>.test.tsx` | bloqué tant que T4 n'est pas corrigé (A6) |
| Handler dont le refus arrive avant tout accès à la base (sans session, limite de débit) | `tests/api/<ressource>/<sujet>.test.ts` | `unit`, sans simuler Prisma (§5) |
| Handler ou service qui lit ou écrit en base | `tests/integration/<domaine>/<sujet>.test.ts` | `integration` |

Ne plus rien créer dans `tests/security/` (T2). `tests/lib/` reste admis par CLAUDE.md pour les fonctions pures ; avant de créer un fichier, chercher le test existant du module (`grep -rl "<module>" src/lib/__tests__ tests/lib`) pour ne pas refaire le doublon `shop-hours` (T7).

## 3. Quatre formes à réutiliser

Exécutées telles quelles sur l'arbre du 2026-11-14 : 20 tests verts, sous `TZ=UTC` comme sous `TZ=America/Los_Angeles` `[L28]`.

```ts
// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { verifyCronAuth } from "@/lib/cron-auth";
import { isAdmin, isBoucher } from "@/lib/roles";
import { canTransition, isTerminal } from "@/lib/order-state-machine";
import { createOrderSchema } from "@/lib/validators/order";

// 1. Table de cas : une ligne par règle métier, le nom du test se lit comme une phrase.
describe("isAdmin / isBoucher", () => {
  it.each([
    ["ADMIN", true, true], // un admin passe aussi les contrôles boucher
    ["webmaster", true, true],
    ["BOUCHER", false, true],
    ["boucher", false, true], // insensible à la casse : Clerk stocke en minuscules, la base en majuscules
    ["CLIENT", false, false],
    ["CLIENT_PRO", false, false],
    [undefined, false, false],
    ["", false, false],
  ])("rôle %s → admin %s, boucher %s", (role, admin, boucher) => {
    expect(isAdmin(role)).toBe(admin);
    expect(isBoucher(role)).toBe(boucher);
  });
});

// 2. Variable d'environnement : vi.stubEnv + remise à zéro, jamais d'affectation directe.
describe("verifyCronAuth", () => {
  afterEach(() => vi.unstubAllEnvs());
  const request = (headers: Record<string, string>) => new NextRequest("http://localhost/api/cron/x", { headers });

  it("refuse tout quand CRON_SECRET est absent, même un en-tête vide", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronAuth(request({ authorization: "Bearer " }))).toBe(false);
  });

  it("accepte le jeton de Vercel Cron et rien d'autre", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(verifyCronAuth(request({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(verifyCronAuth(request({ authorization: "Bearer autre" }))).toBe(false);
    expect(verifyCronAuth(request({}))).toBe(false);
  });
});

// 3. Propriété sur un domaine fini : on parcourt l'enum, on n'énumère pas les cas à la main.
describe("machine à états — propriétés", () => {
  const statuses = Object.values(OrderStatus);

  it("un statut terminal n'a aucune sortie, et un statut non terminal en a au moins une", () => {
    for (const from of statuses) {
      const exits = statuses.filter((to) => canTransition(from, to));
      expect(exits.length === 0, `${from} → [${exits.join(", ")}]`).toBe(isTerminal(from));
    }
  });

  it("aucun statut ne boucle sur lui-même", () => {
    for (const status of statuses) expect(canTransition(status, status), status).toBe(false);
  });
});

// 4. Validateur Zod : un cas valide minimal, puis un champ fautif à la fois, vérifié par le chemin de l'erreur.
describe("createOrderSchema", () => {
  const valid = {
    shopId: "shop_1",
    items: [{ productId: "prod_1", quantity: 1 }],
    paymentMethod: "ON_PICKUP",
    idempotencyKey: randomUUID(),
    expectedTotalCents: 1290,
  };

  it("accepte la commande minimale", () => {
    expect(createOrderSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["panier vide", { ...valid, items: [] }, "items"],
    ["quantité décimale (une ligne au poids compte des portions)", { ...valid, items: [{ productId: "prod_1", quantity: 1.5 }] }, "items.0.quantity"],
    ["paiement en ligne (pas encore ouvert)", { ...valid, paymentMethod: "ONLINE" }, "paymentMethod"],
    ["créneau qui n'est pas une date ISO", { ...valid, pickupSlotStart: "demain 10h" }, "pickupSlotStart"],
    ["clé d'idempotence absente", { ...valid, idempotencyKey: undefined }, "idempotencyKey"],
  ])("refuse : %s", (_label, body, path) => {
    const result = createOrderSchema.safeParse(body);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(path);
  });

  // Le navigateur n'envoie jamais un montant : le schéma strict refuse le champ (défauts D1 et D2).
  it.each([
    ["un prix de coupe", { items: [{ productId: "prod_1", quantity: 1, cutPriceCents: 1 }] }],
    ["une remise", { discountCents: 2000 }],
  ])("refuse un montant envoyé par le navigateur : %s", (_label, extra) => {
    const result = createOrderSchema.safeParse({ ...valid, ...extra });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
```

Pourquoi ces formes :

- **La table** rend visible le cas qui manque. `tests/security/multitenant.test.ts` affirme qu'un rôle `admin` en minuscules n'est pas admin ; la vraie fonction dit le contraire. Le test est vert parce qu'il vérifie une copie : importer le vrai module aurait suffi.
- **La propriété** survit aux évolutions de la table. Une matrice de transitions recopiée dans le brouillon de ce skill était fausse quelques heures plus tard (le chantier 0 avait ajouté deux transitions) `[L15]`. La table exacte se vérifie à un seul endroit : `src/lib/__tests__/order-state-machine.test.ts`. **Un skill, un commentaire ou un test voisin ne recopient jamais une table métier.** De même pour un montant : un test d'intégration prend le total attendu dans le devis du serveur (`create-order-fixtures.ts`), un test unitaire de prix l'écrit en dur à partir d'un exemple calculé à la main.
- **Le validateur** est testé par le chemin de l'erreur, pas par son message : le message est du contenu, il change.

## 4. Le temps

Les fonctions Vercel tournent en UTC, le Mac du développeur à Paris, la CI en UTC. Règles tirées de `src/lib/__tests__/paris-time.test.ts`, qui les applique déjà :

1. **L'instant est une entrée** `[MF1]`. Toute fonction qui dépend de l'heure reçoit un `Date` ; le test fournit un instant UTC explicite : `new Date("2026-01-15T12:09:00Z")`. Jamais `new Date(2026, 0, 15, 13, 9)` : ce constructeur dépend du fuseau de la machine.
2. **Couvrir hiver, été et les deux bascules** (dernier dimanche de mars et d'octobre) pour tout ce qui touche créneaux et horaires.
3. **Quand le code lit l'horloge lui-même** (`Date.now()` dans `isCancellable`, minuteurs d'un hook) : `vi.useFakeTimers()` puis `vi.setSystemTime(new Date("…Z"))` dans `beforeEach`, `vi.useRealTimers()` dans `afterEach`. `vi.setSystemTime` ne se remet pas à zéro tout seul `[VT3]`.
4. **Faire avancer le temps, ne pas l'attendre** : `await vi.advanceTimersByTimeAsync(5_000)` ; la variante asynchrone déclenche aussi les minuteurs posés de façon asynchrone `[VT6]`. C'est celle de `use-order-polling.test.ts`.
5. **Contrôle avant de pousser un test de temps** : `TZ=UTC npx vitest run <fichier>` puis `TZ=America/Los_Angeles npx vitest run <fichier>`. Les deux doivent passer.

## 5. Simulations

| On simule | On ne simule pas |
|---|---|
| La session Clerk (`@clerk/nextjs/server`) | `@/lib/boucher-auth`, `@/lib/admin-auth`, `@/lib/auth/server-auth` quand on teste un accès : c'est là que vit la règle |
| Les transports : `@/lib/email`, `@/lib/push`, `@/lib/whatsapp`, Stripe, Anthropic, Replicate, Blob | `@/lib/notifications` en entier : il écrit aussi les notifications en base |
| L'horloge ; `fetch` côté navigateur dans un test de hook | `@/lib/prisma`, **jamais** (CLAUDE.md) : ce qui touche la base se teste en intégration |
| `@/lib/rate-limit` quand le sujet du test est ailleurs | Le module testé lui-même ni ses fonctions internes : une simulation ne touche que les accès externes `[VT3]` |

Simuler retire la confiance dans ce qui est simulé `[KCD1]` : chaque `vi.mock` doit pouvoir répondre à « quelle frontière réseau est-ce ? ». La documentation de Prisma admet un client simulé pour tester la logique d'une fonction `[PR2]` ; **CLAUDE.md est plus strict et l'emporte : on ne simule jamais `@/lib/prisma`**. Quatre fichiers hérités le font encore (T1) : ils se migrent, ils ne se copient pas.

Ce qui reste légitime en `unit` pour un handler : le refus qui arrive **avant** tout accès à la base. Importer le handler sans base ni `DATABASE_URL` fonctionne (le client Prisma ne se connecte qu'à la première requête) `[L28]`. Dès que la réponse dépend d'une ligne (403 d'un client, 404 d'une autre boutique), d'une écriture ou d'une course : intégration ([integration-postgres.md](integration-postgres.md)).

Forme correcte en Vitest 4, exécutée sans base : 2 tests verts `[L28]`.

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Frontières simulées : la session Clerk et la limite de débit. Ni Prisma, ni le handler, ni nos helpers d'identité.
const clerk = vi.hoisted(() => ({ auth: vi.fn() })); // créé avant les imports, lisible par la fabrique [VT6]
vi.mock("@clerk/nextjs/server", () => clerk);
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn(), rateLimits: { orders: null, api: null } }));
vi.mock("@/lib/rate-limit", () => rateLimit);

import { POST } from "@/app/api/orders/route";

const post = () => POST(new NextRequest("http://localhost/api/orders", { method: "POST", body: JSON.stringify({}) }));

beforeEach(() => {
  vi.clearAllMocks(); // efface l'historique, garde les implémentations [VT6]
  clerk.auth.mockResolvedValue({ userId: null });
  rateLimit.checkRateLimit.mockResolvedValue({ success: true });
});

describe("POST /api/orders — câblage, sans base", () => {
  it("sans session : 401, la limite de débit n'est même pas consultée", async () => {
    const response = await post();
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
  });

  it("limite de débit atteinte : 429 avant toute lecture en base", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_cablage_1" });
    rateLimit.checkRateLimit.mockResolvedValue({ success: false });
    const response = await post();
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("CAPACITY_EXCEEDED");
  });
});
```

Un module à export par défaut se simule avec la clé `default` : `vi.mock("<module>", () => ({ default: … }))` `[VT6]`.

Pièges, tous vérifiés dans la documentation de la version 4 :

- **`vi.restoreAllMocks()` ne remet plus à zéro les `vi.fn()`**, seulement les `vi.spyOn` `[VT1]`. Pour vider les compteurs : `vi.clearAllMocks()` ; pour retirer aussi les implémentations : `vi.resetAllMocks()` `[VT6]`.
- **Une simulation construite avec `new`** doit être une `function` ou une `class`, pas une fonction fléchée `[VT1]`.
- **`vi.stubGlobal` et `vi.stubEnv`** se défont par `vi.unstubAllGlobals()` / `vi.unstubAllEnvs()` dans `afterEach` `[VT3]`.
- **Un `vi.mock` commun à plusieurs fichiers va dans un `setupFiles`** (c'est le cas de `templates/integration/setup/clerk-mock.ts`) : il doit être enregistré avant le premier import du module simulé `[VT3]`.
- **État partagé avec une fabrique `vi.mock`** : dans un même fichier, `vi.hoisted` (exemple ci-dessus) ; entre un `setupFiles` et les fichiers de test, un module ordinaire lu par import dynamique dans la fabrique (`helpers/session.ts`). Jamais une simple variable de fichier : la fabrique est remontée avant elle `[VT6]`.
- **Réseau dans un test de hook** : `vi.stubGlobal("fetch", …)` suffit pour un ou deux appels. Au-delà, MSW est l'outil recommandé par Vitest `[VT4][MSW1]` ; il n'est pas installé (A1).

## 6. Hooks et composants

Exemple exécuté (3 tests verts avec l'option `oxc`) `[L21][L28]` — utilisable dès que T4 est corrigé :

```tsx
// tests/components/ConfirmDialog.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Vider le panier ?",
    description: "Tous les articles seront supprimés.",
    confirmLabel: "Vider le panier",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props} />);
  return props;
}

describe("ConfirmDialog", () => {
  it("expose un dialogue nommé par son titre", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Vider le panier ?" })).toBeInTheDocument();
  });

  it("confirmer : appelle onConfirm puis demande la fermeture, sans appeler onCancel", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Vider le panier" }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("fermé : rien n'est rendu", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

Règles :

- **Requêtes par rôle et nom** (`getByRole`), puis par libellé ou texte ; `getByTestId` en dernier recours `[TL1]`. Jamais `container.querySelector` ni une classe Tailwind `[KCD3]`.
- **`queryBy…` uniquement pour affirmer une absence** ; `findBy…` pour ce qui arrive après un rendu asynchrone, pas `waitFor(() => getBy…)` `[KCD3]`.
- **Tester le comportement** : ce qui est affiché, ce qui est appelé, ce qui est désactivé. Pas la liste des classes, pas l'état interne `[PW1]`.
- **`fireEvent` aujourd'hui**, parce que `@testing-library/user-event` n'est pas installé. `user-event` simule l'interaction complète (frappe, focus) `[TL2][KCD3]` : arbitrage A1.
- **Pas de test Vitest pour un Server Component `async`** : non pris en charge, Next recommande le bout en bout `[NX1]`. Extraire le calcul dans une fonction pure testée, couvrir la page par un parcours.
- **Un composant qui appelle `useUser`, `useRouter`, `useCart`** : simuler `@clerk/nextjs` et `next/navigation` dans le fichier, envelopper avec le vrai fournisseur de panier (piste non exécutée ici : aucun test de ce type n'existe encore dans le dépôt).
- **Ne tester en DOM que ce qui a de la logique** : un formulaire, un sélecteur de quantité, un minuteur. Un composant de pure mise en page ne mérite pas de test ; son rendu se vérifie dans un parcours.

## 7. Modules purs encore sans test

Relevé du 2026-11-14 `[L18]` : aucun fichier de test n'importe ces modules. Chacun se teste en `unit`, sans simulation.

| Module | Fonctions | Risque couvert |
|---|---|---|
| `src/lib/roles.ts` | `isAdmin`, `isBoucher` | Contrôle d'accès (aujourd'hui « testé » par une copie fausse, T2) |
| `src/lib/cron-auth.ts` | `verifyCronAuth` | Un cron appelable sans secret |
| `src/lib/services/weight.service.ts` | `checkWeightDeviation`, `determinePostWeighingStatus`, `formatWeightMessage` | Tolérance de poids, donc prix final |
| `src/lib/conversion-config.ts` | `getConversionRule` | Bornes et pas de quantité par catégorie |
| `src/lib/product-snooze.ts` | `formatSnoozeRemaining` (seule fonction pure du module ; `snoozeProduct` et `unsnoozeExpiredProducts` écrivent en base : intégration) | Affichage de la durée restante |

Le panier, lui, est désormais testé à la source : `src/lib/cart/cart-line.ts` (`src/lib/__tests__/cart-line.test.ts`), sur les fonctions de prix de `src/lib/pricing/*`. C'est le modèle.

Règle générale : quand la logique à tester est enfermée dans un composant ou un handler, on l'**extrait** dans `src/lib/` et on teste l'extrait. On ne la recopie jamais dans le test.

## 8. Ce qu'un bon test unitaire contient

- Un nom qui énonce la règle (`refuse tout quand CRON_SECRET est absent`), pas le nom de la fonction.
- Trois temps visibles : préparer, agir, vérifier `[MF2]`. Une seule action par test.
- Une valeur attendue écrite en dur, jamais recalculée avec la même formule que le code.
- Les bornes : zéro, vide, `null`, la valeur juste avant et juste après un seuil (5 minutes d'annulation, 30 minutes avant retrait, palier d'ajustement de prix).
- Aucune dépendance à l'ordre d'exécution ni à un autre test.
- Un échec constaté avant le succès : casser volontairement la règle dans le code, voir le test rougir, rétablir `[AN1]`.
