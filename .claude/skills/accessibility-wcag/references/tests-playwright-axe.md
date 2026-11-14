# Tester l'accessibilité — Playwright, axe-core, lint, contrôle manuel

Stratégie générale des tests (pyramide, CI, données de test) : voir le skill `testing-strategy`. Ce fichier ne couvre que l'accessibilité. Identifiants entre crochets : `sources.md`.

## 1. État de l'outillage au 2026-11-13

| Fait vérifié `[V1][V6]` | Conséquence |
|---|---|
| `@playwright/test` 1.59.1 installé ; `playwright.config.ts` : `testDir: ./tests/e2e`, projets `chromium` et `mobile` (Pixel 7) | Les specs d'accessibilité vont dans `tests/e2e/*.spec.ts` |
| `baseURL` par défaut : `https://klikandgo.app` | Sans `PLAYWRIGHT_BASE_URL`, les tests visent la production : lecture seule obligatoire, jamais de commande ni de formulaire soumis |
| La CI (`.github/workflows/ci.yml`) lance lint, typecheck, Vitest et build, pas Playwright | Un test axe ne protège rien tant qu'il n'est pas lancé à la main ou ajouté à la CI |
| `@axe-core/playwright` n'est pas installé | Variante A ci-dessous après installation ; variante B utilisable tout de suite |
| `axe-core` 4.11.1 présent par transitivité (`eslint-config-next` → `eslint-plugin-jsx-a11y`) | La variante B en dépend : fragile, à remplacer par la A dès que possible |
| Sur la machine de développement, Chromium 1208 est installé alors que Playwright 1.59.1 attend la révision 1217 | `npx playwright install chromium` avant le premier lancement |
| `tests/components/FormWizard.test.tsx` est exclu de Vitest (chargement JSX cassé) | Pas de test de composant React fiable aujourd'hui : l'accessibilité se teste dans le navigateur |

## 2. Ce que l'automatique voit, et ce qu'il ne voit pas

axe-core annonce trouver en moyenne 57 % des problèmes WCAG et vise zéro faux positif `[T3]`. La documentation Playwright rappelle que beaucoup de problèmes ne se découvrent qu'à la main `[T1]`.

| axe détecte | axe ne détecte pas |
|---|---|
| Contraste du texte sur fond uni | Contraste sur image ou dégradé (classé `incomplete`) |
| Nom manquant d'un bouton, lien, champ, image | Nom présent mais faux ou inutile (« Supprimer » × 10) |
| Rôles et attributs ARIA invalides, éléments interactifs imbriqués | Comportement clavier d'un rôle (flèches d'un `tablist`) |
| `lang`, repères en double, `id` dupliqués | Ordre de focus, piège de focus, retour du focus |
| Taille de cible, si le tag `wcag22aa` est demandé | Messages d'état non annoncés |
| | Focus masqué par une barre collante, mouvement, son, délais |

Deux pièges vérifiés dans axe-core 4.11.1 `[V1]`, à partir de la liste officielle des tags `[T4]` :

- `target-size` (2.5.8) est désactivée par défaut. Elle ne tourne que si `wcag22aa` figure dans les tags.
- Avec des tags WCAG seuls, les règles `best-practice` (`landmark-no-duplicate-main`, `landmark-unique`, `heading-order`, `region`, `aria-dialog-name`) ne tournent pas. Les ajouter pour un audit, pas pour le garde-fou de non-régression.

Un scan ne voit que l'état affiché : scanner aussi le dialogue ouvert, l'erreur de formulaire affichée, le thème sombre, la largeur mobile.

## 3. Fixture axe

### Variante B — fonctionne avec ce qui est installé (compilée et exécutée `[V4][V6]`)

```ts
// tests/e2e/fixtures/axe.ts
import { readFileSync } from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";
import type { AxeResults } from "axe-core";

const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type AxeOptions = { include?: string; tags?: string[] };

export async function runAxe(page: Page, options: AxeOptions = {}): Promise<AxeResults> {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(
    async ({ include, tags }) => {
      const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
      const context = (include && document.querySelector(include)) || document;
      return axe.run(context, { runOnly: { type: "tag", values: tags } });
    },
    { include: options.include ?? null, tags: options.tags ?? WCAG_TAGS },
  );
}

export const test = base.extend<{ axe: (options?: AxeOptions) => Promise<AxeResults> }>({
  axe: async ({ page }, use, testInfo) => {
    await use(async (options) => {
      const results = await runAxe(page, options);
      await testInfo.attach("axe-violations", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
      return results;
    });
  },
});

export { expect };
```

`page.evaluate` injecte axe sans balise `<script>` : la CSP du site ne le bloque pas. Le rapport complet est attaché au test `[T1]`.

### Variante A — cible, après `npm install -D @axe-core/playwright`

Version 4.14.0 au 2026-11-13, qui embarque `axe-core ~4.14.0` `[T5]`. Extrait repris de la documentation Playwright `[T1]`, **non compilé ici** faute du paquet :

```ts
import { test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const test = base.extend<{ makeAxeBuilder: () => AxeBuilder }>({
  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]));
  },
});
export { expect } from "@playwright/test";
```

Usage : `const results = await makeAxeBuilder().include("#main-content").analyze();`. La documentation prévoit `exclude` (qui retire un élément et tous ses descendants de toutes les règles) et `disableRules` (présenté comme temporaire) pour les problèmes connus `[T1]`. Notre choix est différent : la liste `KNOWN` par page du §4, qui garde la dette visible et datée. L'exemple de la documentation s'arrête au tag `wcag21aa` ; nous ajoutons `wcag22aa` pour la taille des cibles `[V1][V9]`.

## 4. Garde-fou de non-régression sur les pages publiques

Exécuté contre la production le 2026-11-13 : 10 tests passent `[V6]`. La liste `KNOWN` est la dette connue par page ; un test échoue dès qu'une règle nouvelle apparaît. On ne compare pas les sélecteurs : ils changent avec les données.

```ts
// tests/e2e/a11y.spec.ts
import { test, expect } from "./fixtures/axe";

// Dette connue au 2026-11-13 (references/audit-code-2026-11.md §2). Objectif : des tableaux vides.
const KNOWN: Record<string, string[]> = {
  "/": ["color-contrast"],
  "/panier": ["color-contrast", "link-name"],
  "/boucherie-halal/chambery": ["color-contrast"],
  "/bons-plans": ["color-contrast"],
};

for (const path of Object.keys(KNOWN)) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`axe ${path} (${colorScheme})`, async ({ page, axe }) => {
      if (colorScheme === "dark") {
        await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
      }
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const results = await axe();
      const rules = Array.from(new Set(results.violations.map((violation) => violation.id)));
      expect(rules.filter((rule) => !KNOWN[path].includes(rule))).toEqual([]);
    });
  }
}

test("clavier : le premier Tab atteint le lien d'évitement", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
});

test("structure : un seul main et un seul h1", async ({ page }) => {
  await page.goto("/panier");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});
```

Le thème sombre se force par `localStorage.theme`, comme le fait `ThemeProvider.tsx`. Ajouter `/boutique/<slug>` avec `["color-contrast", "nested-interactive"]` dès qu'un slug stable de test existe. Règle d'équipe : toute correction retire une entrée de `KNOWN` dans le même commit ; aucune entrée n'est ajoutée sans ligne correspondante dans l'audit.

## 5. Tests de comportement (ce qu'axe ne voit pas)

Ces tests décrivent la cible. Au 2026-11-13, le premier échouait en production (dans sa forme sans l'exception `spin`) `[V6]` ; les deux suivants supposent les correctifs de `patterns-composants.md` (§3 et §4 pour le dialogue, §6 et §7 pour la cuisine). Les trois ont été compilés, pas exécutés dans leur forme actuelle `[V9]`. `spin` est le nom de l'animation de `animate-spin`, que le patron §12 laisse tourner.

```ts
import { test, expect } from "./fixtures/axe";

test("mouvement réduit : aucune animation infinie hors indicateur de chargement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const infinite = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll("*")).filter((el) => {
        const style = getComputedStyle(el);
        return (
          style.animationName !== "none" &&
          style.animationName !== "spin" &&
          style.animationIterationCount === "infinite"
        );
      }).length,
  );
  expect(infinite).toBe(0);
});

test("dialogue : nom, focus initial, Échap, retour du focus", async ({ page, axe }) => {
  await page.goto("/panier"); // suppose un panier rempli par la préparation du test
  const opener = page.getByRole("button", { name: "Vider" });
  await opener.click();
  const dialog = page.getByRole("alertdialog", { name: "Vider le panier ?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Annuler" })).toBeFocused();
  const results = await axe({ include: "[role=alertdialog]" });
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("cuisine : onglets exposés comme des onglets", async ({ page }) => {
  await page.goto("/boucher/commandes"); // session boucher de test requise
  await expect(page.getByRole("tablist", { name: "Colonnes de commandes" })).toMatchAriaSnapshot(`
    - tablist "Colonnes de commandes":
      - tab /Nouv/
      - tab /En cours/ [selected]
      - tab /Prêtes/
      - tab /Histo/
  `);
  await page.getByRole("tab", { name: /En cours/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Prêtes/ })).toBeFocused();
  await expect(page.getByRole("switch", { name: "Boutique en ligne" })).toHaveAccessibleName("Boutique en ligne");
});
```

Règles d'écriture :

- Localiser par rôle et nom (`getByRole`) : si le test ne trouve pas le bouton par son nom, un lecteur d'écran non plus. Pas de `locator(".classe")` pour un contrôle.
- `toMatchAriaSnapshot` fige la structure exposée (rôles, noms, états) d'un composant ; mise à jour avec `--update-snapshots` `[T2]`.
- Assertions utiles, toutes présentes en 1.59.1 `[V1]` : `toBeFocused`, `toHaveAccessibleName`, `toHaveAccessibleDescription`, `toHaveRole`, `toHaveAttribute("aria-selected", "true")`.
- Parcours connectés (panier rempli, mode cuisine) : uniquement contre un serveur local ou une préversion en mode test. La session s'ouvre par `POST /api/test-mode/activate` (jeton signé depuis `2364ef9` ; poser les cookies à la main ne fonctionne plus, règle de CLAUDE.md). Gabarits prêts : `.claude/skills/testing-strategy/templates/e2e/` (`auth.setup.ts`, `fixtures/test.ts`). Ces écrans n'ont pas pu être scannés pour ce skill.

## 6. Lint

`eslint-config-next` charge déjà le plugin `jsx-a11y` mais n'active que 6 règles en `warn` `[T8][V1]`. Les règles ci-dessous existent dans la version installée (6.10.2) `[T13]` et peuvent être ajoutées à la section `rules` de `.eslintrc.json` sans installation. Mesuré sur l'arbre de travail du 2026-11-14 avec `npx eslint src --rule …` : 0 erreur, 162 avertissements (128 `label-has-associated-control`, 17 `click-events-have-key-events`, 17 `no-static-element-interactions`), code de sortie 0 `[V9]`. `npm run lint` (`next lint`) continue donc de passer. `.eslintrc.json` ignore `tests/e2e/` : les specs ne sont pas lintées. Activer ces règles reste le point à arbitrer n° 5.

```json
{
  "jsx-a11y/label-has-associated-control": "warn",
  "jsx-a11y/click-events-have-key-events": "warn",
  "jsx-a11y/no-static-element-interactions": "warn",
  "jsx-a11y/interactive-supports-focus": "warn",
  "jsx-a11y/anchor-is-valid": "warn",
  "jsx-a11y/no-redundant-roles": "warn",
  "jsx-a11y/aria-role": "error",
  "jsx-a11y/tabindex-no-positive": "error"
}
```

Ne pas activer `jsx-a11y/no-autofocus` : nous posons volontairement le focus sur « Annuler » dans le compte à rebours. Passer une règle en `error` quand son compteur atteint zéro, c'est-à-dire, pour `label-has-associated-control`, après la migration des formulaires vers le patron §9.

## 7. Contrôle manuel — 15 minutes par parcours touché

Base : les « Easy Checks » du W3C `[W14]`, appliqués à nos écrans.

1. **Clavier seul**, souris débranchée : Tab du haut au bas de l'écran. Tout contrôle est atteint, le focus est toujours visible, jamais sous la barre du bas, l'ordre suit la lecture. Chaque dialogue : le focus y entre, y reste, Échap ferme, le focus revient au bouton d'ouverture.
2. **Lecteur d'écran mobile** : VoiceOver sur Safari iOS et TalkBack sur Chrome Android, puisque nos clients commandent au téléphone. Parcours : choisir un produit, modifier la quantité, choisir un créneau, se tromper d'email, confirmer. Écouter : chaque bouton a-t-il un nom utile, chaque changement est-il annoncé, l'erreur est-elle lue.
3. **Zoom** : 200 % sur ordinateur, puis fenêtre de 320 px de large. Aucun texte coupé, aucun défilement horizontal, aucun bouton hors écran.
4. **Thèmes** : clair et sombre, sur chaque écran touché.
5. **Mouvement réduit** activé dans le système : plus rien ne pulse ni ne rebondit ; les chargements restent compréhensibles.
6. **Tablette cuisine**, tenue à la main puis posée : accepter, refuser, passer « prête » avec un doigt mouillé ou ganté ; lire le numéro de commande à un mètre ; couper le son ; laisser arriver une commande et vérifier que l'alerte se voit sans le son et s'entend sans regarder.
7. **Couleur** : chaque paire texte/fond nouvelle passe par `node .claude/skills/accessibility-wcag/scripts/contrast.mjs '<texte>' '<fond>'`.

Consigner le résultat dans la description de la PR : parcours testé, lecteur d'écran et appareil, défauts restants.

## 8. Commandes

```bash
npx playwright install chromium                      # une fois par machine
npx playwright test tests/e2e/a11y.spec.ts           # garde-fou public (lecture seule, production par défaut)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/a11y.spec.ts
npx playwright test tests/e2e/a11y.spec.ts --project=mobile --reporter=html
npm run lint                                         # règles jsx-a11y
node .claude/skills/accessibility-wcag/scripts/contrast.mjs '#DC2626' '#f8f6f3'
```
