# CI : ce qui doit tourner, et quand

Fichier : `.github/workflows/ci.yml` (déclenché sur `push` vers `main` et sur chaque PR, annulation des lancements périmés). Ce skill **propose** ; la modification du workflow se fait dans une PR dédiée, revue par l'owner. La section « CI/CD » de CLAUDE.md décrit déjà les quatre jobs ci-dessous : la mettre à jour dans la même PR que le workflow. Les runners GitHub standard sont gratuits pour un dépôt public `[GH1]`.

## 1. Aujourd'hui (arbre du chantier 0)

| Job | Commandes | Ce qu'il garantit |
|---|---|---|
| `lint` | `npm run lint` | ESLint sur `src/` (pas `tests/`, T14). |
| `typecheck` | `npx tsc --noEmit` | Typage de `src/` **et** `tests/**`. |
| `test` | service PostgreSQL 16 ; `prisma db push` ; `npm run test:run` (`unit`) ; `npm run test:integration` | ≈ 910 tests purs et simulés, ≈ 230 tests sur base réelle (schéma `itest`) `[GH2][L25]`. |
| `build` | service PostgreSQL 16 ; `db push` ; `npm run build` ; `node scripts/check-prerender.mjs` | Le build passe et les pages publiques restent prérendues (coût CPU, CLAUDE.md). |
| *(aucun)* | Playwright | Rien ne lance les parcours (T3). |

## 2. Cible

Ordre de mise en place : chaque étape est utile seule.

1. **Projets `unit` / `dom` et JSX réparé** (A6) : suite unitaire plus rapide, composants testables. Scripts : `vitest run --project unit --project dom`.
2. **Clerk simulé dans `integration`** (`setup/clerk-mock.ts`, [integration-postgres.md](integration-postgres.md) §3) et suppression de `tests/security/multitenant.test.ts` (T2).
3. **Seuils de couverture par motif** sur les modules de calcul, pas de seuil global `[VT7][KCD1]` (A9) :
   ```ts
   coverage: { thresholds: { "src/lib/pricing/**": { lines: 95, branches: 90 }, "src/lib/cart/**": { lines: 90 } } }
   ```
   et `npm run test:coverage` dans le job `test`. Relever les valeurs réelles avant de fixer les seuils, puis ne jamais les baisser sans décision écrite.
4. **Job `e2e`** (ci-dessous), d'abord non bloquant pendant deux semaines (`continue-on-error: true`), puis bloquant. Pendant la période non bloquante, chaque échec est trié : défaut du produit ou test à corriger `[UB1]`.
5. **Lint de `tests/**`** avec `@typescript-eslint/no-floating-promises` (A10).

## 3. Job `e2e` proposé

Mêmes conventions que les jobs existants : Node 20, `npm ci`, variables du workflow (base `ci` du service PostgreSQL, clés Clerk factices). YAML relu, **jamais exécuté** : le premier lancement se fait dans la PR dédiée, job non bloquant. Recommandations Playwright reprises : `npm ci`, navigateurs installés à chaque fois (pas de cache des binaires `[PW8]`), rapport envoyé même en cas d'échec `[PW7]`, un seul worker `[PW8]`.

```yaml
  e2e:
    name: E2E (Playwright, serveur local en mode test)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: ci, POSTGRES_PASSWORD: ci, POSTGRES_DB: ci }
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci --prefer-offline --no-audit
      - run: npx prisma generate                                      # le seed importe le client généré
      - run: npx prisma db push --skip-generate --accept-data-loss   # migrate deploy échoue sur base vide (T11, A5)
      - run: npx prisma db seed                                       # npx tsx : voir A4
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - name: Playwright
        run: |
          TEST_SECRET="$(openssl rand -hex 24)"; export TEST_SECRET   # jamais dans un fichier suivi
          npx playwright test                                        # = npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with: { name: playwright-report, path: playwright-report/, retention-days: 14 }
```

Points d'attention au premier lancement (non vérifiés, `next build` / `next start` interdits pendant la rédaction) :

- clerk-js ne peut pas se charger avec la clé factice (`host_invalid`, `[L16]`) : vérifier que les pages ne lèvent pas d'exception JavaScript à cause de cela (fixture `pageErrors`) ; sinon filtrer explicitement ce message dans la fixture, avec un commentaire, plutôt que de désactiver la fixture.
- `next start` avec `output: "standalone"` n'émet qu'un avertissement `[L16]`.
- Le secret doit être visible du serveur (lancé par `webServer`, qui hérite de `process.env` `[PW3]`) et de Playwright : d'où l'`export` dans la même étape.
- La base `ci` du service est acceptée par `assertDisposableDatabase` (hôte `localhost`, base `ci`).
- Ce job suppose que `templates/e2e/playwright.config.ts` a remplacé la configuration actuelle : avec celle-ci, `playwright test` viserait la production (T3).

## 4. Ce qu'un développeur lance avant de pousser

| Changement | Avant le push |
|---|---|
| `src/lib/**` pur | `npm run test` (ou `npx vitest run --project unit <fichier>`) |
| Service, route `src/app/api/**`, `prisma/schema.prisma` | + `npm run test:integration` sur une base locale jetable |
| Page, composant, parcours | + `npx playwright test --project=<projet>` sur le serveur local |
| Tout | `npm run lint`, `npx tsc --noEmit`, `npm run build` (CLAUDE.md) |
| Code qui lit l'heure | le fichier de test sous `TZ=UTC` puis `TZ=America/Los_Angeles` |

Lancer d'abord ce qui a changé accélère la boucle : `npx playwright test --only-changed=origin/main` `[PW8]`, `npx vitest related <fichier>` côté Vitest.
