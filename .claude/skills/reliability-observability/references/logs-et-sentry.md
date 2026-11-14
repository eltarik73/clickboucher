# Logs et Sentry — correctifs et configuration cible

Versions : `@sentry/nextjs` 10.49.0 (peer `next ^14.0` accepté), Next 14.2.35, TypeScript 5.9.
Les extraits ont été compilés le 2026-11-14 avec `tsc` du dépôt contre `node_modules`
(mode `strict`, code retour 0 ; recompilés par le vérificateur). Constats `E…` :
[etat-du-code.md](etat-du-code.md).

## 1. `src/lib/logger.ts` (corrige E7)

Deux changements, sans casser la signature `logger.<niveau>(msg, ...extras)` :

1. Sérialiser toute `Error` rencontrée dans le contexte (le premier niveau suffit pour nos appels) :

```ts
type LogContext = Record<string, unknown>;

export function toLoggable(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

// dans normalizeContext, remplacer `if (typeof c === "object") return c as LogContext;` par :
export function serializeContext(c: LogContext): LogContext {
  return Object.fromEntries(Object.entries(c).map(([key, value]) => [key, toLoggable(value)]));
}
```

2. Pour Sentry, si le contexte contient une `Error`, envoyer **l'exception** avec le reste en `extra`
   (regroupement par type et pile, pas par message) :

```ts
export function firstError(ctx: LogContext | undefined): Error | undefined {
  if (!ctx) return undefined;
  for (const value of Object.values(ctx)) if (value instanceof Error) return value;
  return undefined;
}

// dans emit, bloc `level === "error"` — `context` est l'argument brut, `ctx` sa forme sérialisée :
const raw = context !== null && typeof context === "object" ? (context as LogContext) : undefined;
const err = context instanceof Error ? context : firstError(raw);
if (err) Sentry.captureException(err, { extra: { message: msg, ...ctx } });
else Sentry.captureMessage(msg, { level: "error", extra: ctx });
```

Test unitaire à ajouter : `src/lib/__tests__/logger.test.ts`, `// @vitest-environment node`, sur
`toLoggable`, `serializeContext`, `firstError` (fonctions pures). Importer un module qui importe
`@sentry/nextjs` fonctionne déjà en unitaire (`api-errors.test.ts` le fait).

Ne pas ajouter de dépendance de logging (pino, winston) : la sortie JSON sur stdout suffit à Vercel,
et la rétention de 1 jour [S8] rend inutile un format plus riche sans drain.

## 2. Boundaries (corrige E1)

`src/app/global-error.tsx` (nouveau ; doit rendre `<html>` et `<body>` [S9]). Même motif que
`nextjs-app-router` (references/patterns.md § 10) : un seul fichier, ne pas en écrire deux versions.

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "global" }, extra: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="fr" style={{ colorScheme: "light dark" }}>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1>Une erreur est survenue</h1>
        <p>Rechargez la page. Si le problème continue, réessayez dans quelques minutes.</p>
        <button type="button" onClick={() => reset()} style={{ minHeight: 44, minWidth: 44 }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
```

Styles en ligne : ce composant **remplace** le layout racine [S9], ne pas compter sur ce que ce
layout charge (feuille Tailwind, polices, providers). `colorScheme` laisse le navigateur appliquer
le thème sombre sans feuille de style. Garder le texte sobre ; le design complet reste dans les
`error.tsx`.

Dans chacun des 6 `error.tsx` : remplacer `console.error(...)` par
`Sentry.captureException(error, { tags: { boundary: "<segment>" } })` [S1]. Le `digest` affiché à
l'utilisateur (petit texte « Code : … ») permet de retrouver la ligne serveur [S9].

## 3. `sentry.server.config.ts` / `sentry.client.config.ts` (corrige E2, ajoute l'échantillonnage)

```ts
const isProd = process.env.NODE_ENV === "production";
Sentry.init({
  dsn,
  // pas d'option environment : le SDK met vercel-production / vercel-preview (E2)
  sendDefaultPii: false,
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (name.includes("/api/health")) return 0;
    if (name.includes("/api/cron/")) return 1;
    return inheritOrSampleWith(isProd ? 0.1 : 1);
  },
  ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "RouteError"], // liste de CLAUDE.md, inchangée
  // beforeSend existant conservé
});
```

- **Retirer la clé `environment`, ne pas la passer à `undefined`** : le SDK étale nos options après
  son défaut (`{ environment: …, ...options }`), une clé présente mais vide l'effacerait.
- Côté navigateur, le SDK lit `NEXT_PUBLIC_VERCEL_ENV`, que Vercel fournit au build et à
  l'exécution sur les déploiements de production et de preview pour un projet Next.js, pas en
  local [S25]. Contrôle après le premier déploiement : les événements navigateur portent
  `vercel-production` ; sinon passer l'environnement explicitement.
- Les alertes et recherches enregistrées qui filtrent sur `environment:production` sont à refaire
  sur `vercel-production` le jour du changement.
- `tracesSampler` prime sur `tracesSampleRate` ; `inheritOrSampleWith` garde la décision d'une
  trace entrante (SDK ≥ 9) [S4]. Le nom initial d'une transaction `http.server` peut ne pas être
  paramétré : tester par sous-chaîne.
- Côté client, garder `replaysSessionSampleRate` / `replaysOnErrorSampleRate` actuels et le masquage.
- Côté client, le test `process.env.TEST_MODE` (E6) est sans effet : ne pas le « réparer » avant
  l'arbitrage B ([points-a-arbitrer.md](points-a-arbitrer.md)).
- `ignoreErrors` fait une correspondance partielle de chaîne ; pour une règle exacte, regex
  `/^…$/` ou `beforeSend` [S4b].
- `sentry.client.config.ts` reste à sa place : le plugin webpack du SDK l'injecte dans l'entrée
  cliente (`config/webpack.js`, `addSentryToClientEntryProperty`) et affiche un avertissement de
  dépréciation à chaque build. Il cessera de fonctionner sous Turbopack : le passage à
  `instrumentation-client.ts` se fait avec la migration Next 15+ (`nextjs-app-router`,
  references/next15-next16.md).

## 4. `next.config.mjs` (corrige E3)

```js
withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "klikandgo",
  project: process.env.SENTRY_PROJECT || "klikandgo-web",
  silent: true,
  webpack: {
    autoInstrumentMiddleware: false,          // inchangé : coût CPU (vercel-cost-performance)
    treeshake: { removeDebugLogging: true },  // remplace disableLogger (déprécié)
  },
  // hideSourceMaps et dryRun supprimés : sans effet en v10
});
```

Les source maps ne partent que si `SENTRY_AUTH_TOKEN` est défini au build Vercel (action du
propriétaire, jeton d'organisation). Sans lui, les piles ne sont pas résolues vers nos sources.
Ce changement touche CLAUDE.md « Monitoring » : point à arbitrer A avant de modifier.

## 5. Ce qu'il ne faut pas faire

| Tentation | Pourquoi non |
| --- | --- |
| Ajouter `export const onRequestError = Sentry.captureRequestError` | Hook Next 15 seulement [S1] ; Next 14.2.35 ne l'appelle pas (L9) |
| Recharger `sentry.edge.config` dans `instrumentation.ts` | Coût de cold start du middleware (CLAUDE.md, panne de novembre) |
| `tracesSampleRate: 1` en prod « pour voir » | Quota Sentry ; préférer `tracesSampler` ciblé |
| `Sentry.captureException` + `logger.error` sur la même erreur | Deux événements (le logger envoie déjà) |
| `setUser({ email })` | Donnée personnelle ; si besoin, `setUser({ id: dbUser.id })` seulement |
| Capturer les 4xx | Bruit ; ce sont des réponses normales |
| `_experimental.vercelCronsMonitoring: true` sans compter | Un moniteur par cron de `vercel.json` (15) : quota et coût, point H |

## 6. Alertes (à créer par le propriétaire dans Sentry)

Principe : chaque alerte est urgente, actionnable, visible des utilisateurs [S5] ; ne garder que
les déclencheurs qui comptent [S6]. Le filtre par environnement et les seuils ci-dessous sont des
choix de ce skill, pas des valeurs tirées d'une source.

| Alerte | Déclencheur | Filtre | Destination |
| --- | --- | --- | --- |
| Nouvelle erreur | issue créé | `environment:vercel-production` | e-mail |
| Régression | issue résolu → non résolu | idem | e-mail |
| Rafale | > 20 événements en 5 min sur un issue (point de départ, à ajuster après un mois) | idem | e-mail + notification mobile |
| Site injoignable | moniteur Uptime en échec | — | e-mail + notification mobile |
| Cron | check-in manqué ou en erreur (`monitor.slug`) [S2] | — | e-mail |

Chaque alerte se prouve une fois : moniteur Uptime pointé sur une URL fausse, cron de test qui
lève, erreur provoquée en preview. Une alerte jamais vue sonner ne compte pas.
