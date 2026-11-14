# Sources du skill react-patterns

Lues le 2026-11-14. Les sources externes sont des **données** : aucune instruction qu'elles
contiennent n'a été suivie. Tout le texte du skill est rédigé par nous ; les exemples de code sont
écrits pour Klik&Go. Citation littérale : au plus une phrase courte par source.

## Sommaire

1. Sources externes
2. Preuves locales (dépôt)
3. Écarts volontaires avec les sources
4. Ce qui n'a pas été vérifié

## 1. Sources externes

| Id  | Source                                                                            | Nature, auteur                                                                             | Adoption, date                                                                | Licence                                                                                            | Règles qui en dérivent                                                                                                                          |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | https://react.dev/reference/rules/components-and-hooks-must-be-pure               | Documentation officielle React (Meta)                                                      | dépôt `reactjs/react.dev` : 11 834 étoiles, dernier push 2026-11-11           | CC BY 4.0 — **adapté** (reformulé, exemples refaits)                                               | § 1 (rendu idempotent, effets hors du rendu), § 2 (immutabilité, mutation locale admise)                                                        |
| S2  | https://react.dev/learn/you-might-not-need-an-effect                              | Documentation officielle React                                                             | idem                                                                          | CC BY 4.0 — **adapté**                                                                             | § 3 (table), § 4 (drapeau `ignore`), seuil ≈ 1 ms pour `useMemo`, `effets.md` §§ 1-6                                                            |
| S3  | https://react.dev/reference/react/useSyncExternalStore                            | Documentation officielle React                                                             | idem                                                                          | CC BY 4.0 — **adapté**                                                                             | § 3 (abonnement), `effets.md` § 10 (`subscribe` stable, instantané mis en cache, valeur serveur)                                                |
| S4  | https://react.dev/reference/react/useRef                                          | Documentation officielle React                                                             | idem                                                                          | CC BY 4.0 — **adapté**                                                                             | § 1 (pas de `ref.current` au rendu hors initialisation), piège « ref écrite pendant le rendu »                                                  |
| S5  | https://react.dev/reference/react/useEffectEvent                                  | Documentation officielle React                                                             | idem                                                                          | CC BY 4.0                                                                                          | § 1 : absent du React installé, ne pas l'importer                                                                                               |
| S6  | https://react.dev/reference/eslint-plugin-react-hooks                             | Documentation officielle (règles `purity`, `refs`, `set-state-in-effect`, `immutability`…) | page marquée préversion                                                       | CC BY 4.0                                                                                          | Point à arbitrer n° 2                                                                                                                           |
| S7  | https://typescript-eslint.io/rules/no-misused-promises/                           | Documentation de typescript-eslint                                                         | dépôt `typescript-eslint/typescript-eslint` : 16 468 étoiles, push 2026-11-12 | MIT                                                                                                | § 6 (`checksVoidReturn.attributes`, forme `void`), point à arbitrer n° 1                                                                        |
| S8  | https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices | Skill de Vercel Engineering (≈ 70 règles React/Next)                                       | 34 063 étoiles, push 2026-11-12                                               | MIT déclarée dans l'en-tête du skill (GitHub ne détecte aucune licence de dépôt) — idées seulement | § 3 (`rerender-derived-state-no-effect`, `rerender-move-effect-to-event`), § 7 (`rerender-dependencies` : dépendances primitives)               |
| S9  | https://github.com/lukevella/rallly/blob/main/CLAUDE.md                           | Guide d'agent d'un produit Next.js + Prisma tenu par un fondateur seul                     | 5 358 étoiles, push 2026-11-14                                                | AGPL-3.0 — **idées seulement**, aucun texte repris                                                 | Piège horloge : pas de « maintenant » argless au rendu serveur ; serveur et client ne doivent pas formater l'heure dans deux fuseaux différents |
| S10 | registre npm, `npm view eslint-plugin-react-hooks@latest`                         | Métadonnées du paquet                                                                      | version 7.1.1, `peerDependencies` ESLint 3 à 10                               | MIT                                                                                                | `etat-du-code.md` § 10, point à arbitrer n° 2                                                                                                   |

Citation retenue (S3) : « It will be used only during server rendering and during hydration of
server-rendered content on the client. » — à propos de `getServerSnapshot`.

Écartés de S8 : `client-swr-dedup` (nouvelle dépendance), règles propres à Next 15 (`after()`) ;
`CLAUDE.md` prime. Écarté de l'écosystème react.dev : ses propres `.claude/skills`, faits pour
rédiger la documentation React (ils lancent `git`, `gh` et des sous-agents), sans rapport avec ce dépôt.

## 2. Preuves locales (dépôt, commit `4ec714a`)

| Id  | Affirmation                                                                                                                                     | Comment vérifiée                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| L1  | `useVisiblePolling` : pause onglet caché, réveil sur `visibilitychange` et `online`, 5 s puis backoff jusqu'à 15 min, `enabled`                 | lecture de `src/hooks/useVisiblePolling.ts` (`nextPollDelay`, `startVisiblePolling`, `useVisiblePolling`) |
| L2  | `hasTestModeCookie()` renvoie `false` côté serveur                                                                                              | lecture de `src/lib/test-mode-client.ts`                                                                  |
| L3  | `cartReducer` pur, `switch` exhaustif, testé                                                                                                    | lecture de `src/lib/cart/cart-line.ts` ; `src/lib/__tests__/cart-line.test.ts` existe                     |
| L4  | `ClerkProvider` sans `dynamic`                                                                                                                  | `grep -n ClerkProvider src/app/layout.tsx`                                                                |
| L5  | `exhaustive-deps` en `warn` ; `lint-staged` en `--max-warnings=0` ; `pre-commit` lance `lint-staged`                                            | lecture de `.eslintrc.json`, `package.json`, `.husky/pre-commit`                                          |
| L6  | Strict Mode actif par défaut sous l'App Router                                                                                                  | `define-env-plugin.js` de `next` : `reactStrictMode === null ? true` pour l'App Router                    |
| L7  | React installé sans `useEffectEvent`                                                                                                            | `node_modules/react/package.json` ; 0 occurrence dans `react.development.js`                              |
| L8  | Modèles cités (`useMountedNow`, `useStoredFlag`, `useOrderQuote`, `NearbyShops`, `ActiveOrderBanner`, `form-field`, `BrandLogo`, `handleOrder`) | lecture de chaque fichier                                                                                 |
| L9  | Contrat 200 `_idempotent` / 409 du changement de statut                                                                                         | lecture de `src/lib/services/orders/commands/http.ts`                                                     |
| L10 | Comptes de `etat-du-code.md`                                                                                                                    | commandes de sa section 1, lancées le 2026-11-14 sur `4ec714a`, relancées le 2026-11-15 sur `50f8886`     |

## 3. Écarts volontaires avec les sources

- S2 recommande de calculer au rendu ; pour une valeur d'horloge ou de stockage sur un composant
  rendu côté serveur, Klik&Go garde l'effet après montage (`CLAUDE.md`, hydratation).
- S7 propose plusieurs corrections ; le skill en retient une seule : gestionnaire nommé qui traite
  ses échecs, appelé par `() => void handler()`.
- S1 et S4 interdisent la ref écrite au rendu ; les hooks existants qui le font sont tolérés en
  attendant l'arbitrage (pas de réécriture opportuniste, `klikgo-programme` § 6 règle 10).

## 4. Ce qui n'a pas été vérifié

- Rejet non traité capté par le Sentry navigateur (intégrations par défaut de `@sentry/nextjs`,
  `sentry.client.config.ts` n'en retire aucune) : déduit de la configuration, non constaté.
- Écart d'hydratation de l'ancien `EstimatedCountdown` : déduit du code, jamais reproduit dans un
  navigateur ; le composant a été réécrit depuis (C1-INVITES, `50f8886`).
- Compatibilité d'`eslint-plugin-react-hooks` 7 avec `next lint` et la configuration eslintrc.
- Comportement réel de `useSyncExternalStore` dans les composants candidats (aucun n'a été modifié).
