# Santé, sondes externes et moniteurs de crons

## 1. Ce qu'on surveille (signaux d'or appliqués à Klik&Go)

Surveiller d'abord les **symptômes** visibles des clients ; les causes servent au diagnostic [S5].

| Signal [S5] | Mesure chez nous | Où |
| --- | --- | --- |
| Erreurs | 5xx des fonctions, issues Sentry `vercel-production` | Sentry, Vercel Logs (filtre status) |
| Latence | p95 des routes API, temps de `/api/health` | Sentry Performance (10 %), champ `ms` de la sonde |
| Trafic | commandes créées par jour, invocations | requête SQL sur `orders`, Vercel Usage |
| Saturation | CPU actif du mois (quota), `P2024` (pool), connexions Railway | Vercel Usage, Sentry, tableau Railway |

Un succès apparent peut être une erreur (« implicite », réponse 200 au mauvais contenu) [S5] :
c'est exactement `sendEmail` qui renvoie `true` sans rien envoyer (E9). Mesure métier à suivre :
une commande `READY` sans e-mail ni push envoyé.

## 2. `/api/health` cible (corrige E12)

Reste hors matcher Clerk (test `src/lib/__tests__/middleware-matcher.test.ts`) et n'importe aucun
helper d'auth Clerk (`verifyCronAuth` n'en est pas un). Compilé le 2026-11-14 :

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { verifyCronAuth } from "@/lib/cron-auth";
import { withDeadline } from "@/lib/with-deadline"; // appels-externes.md § 3 (à créer, fonction pure testée)

export const dynamic = "force-dynamic";

type Check = "ok" | "fail" | "not_configured";

async function probe(run: () => Promise<unknown>, ms: number, label: string): Promise<Check> {
  try {
    await withDeadline(run(), ms, label);
    return "ok";
  } catch {
    return "fail";
  }
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const raw = redis.raw;
  const [db, cache] = await Promise.all([
    probe(() => prisma.$queryRaw`SELECT 1`, 3_000, "health/db"),
    raw ? probe(() => raw.ping(), 800, "health/redis") : Promise.resolve<Check>("not_configured"),
  ]);
  const status = db !== "ok" ? "down" : cache === "fail" ? "degraded" : "ok";
  // Route publique : le détail dirait ce qui est configuré en production. Réservé à l'appel authentifié.
  const body = verifyCronAuth(req)
    ? { status, checks: { db, redis: cache }, ms: Date.now() - started, release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null }
    : { status };
  return NextResponse.json(body, {
    status: db === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
```

Décisions :
- **503 uniquement si la base tombe** : sans base, ni commande ni tableau boucher. Redis en panne =
  `status: "degraded"` en 200 (le site sert sans cache) — sinon la sonde réveille pour un cache.
- Les deux sondes partent **en parallèle** : la réponse arrive en 3 s au plus, base coupée.
- `not_configured` distinct de `ok`, sans le cacher derrière `skip`. Même principe pour Resend et
  VAPID si on les ajoute (présence de la variable seulement, jamais d'appel au fournisseur dans la
  sonde).
- **Route publique : l'état de configuration ne se publie pas.** Un appel anonyme reçoit `status`
  et le code HTTP, ce qui suffit aux sondes externes ; `checks`, `ms` et `release` ne partent qu'avec
  `Authorization: Bearer <CRON_SECRET>` (même garde que les crons). Test : sans en-tête, la réponse
  n'a que la clé `status`.
- Pas de détail d'erreur, d'hôte, de version de base dans la réponse.
- Les `catch` de la sonde sont la seule exception assumée à « tracer chaque catch » : l'état est la
  réponse elle-même ; la sonde externe journalise l'échec.
- Coût : une sonde toutes les 5 min = 288 invocations par jour (≈ 8 640 par mois), chacune avec un
  `SELECT 1`. Le compteur qui a causé la panne est le CPU actif, pas les invocations : chiffrer
  avec `vercel-cost-performance` avant de descendre sous 5 min.

## 3. Sondes externes (corrige E15)

| Sonde | Cible | Fréquence | Pourquoi |
| --- | --- | --- | --- |
| Sentry Uptime n° 1 (inclus dans tout plan [S26]) | `https://klikandgo.app/api/health` | 5 min | exécute une fonction et la base ; voit aussi une suspension du projet (402 sur toutes les routes), le DNS, le certificat |
| Sentry Uptime n° 2 (plan payant + budget, point H) | `https://klikandgo.app/` | 5 min | page servie par le CDN : distingue « plateforme en panne » de « fonction ou base en panne » |
| GitHub `uptime.yml` (filet) | `/` et `/sitemap.xml` | 6 h | contrôle `x-vercel-error` ; peut être désactivé après 60 jours sans activité [S12] |

Sentry Uptime [S3] : intervalles de 1 min à 1 h ; 2xx attendu ; redirections suivies ; délai de
10 s par requête ; vérifications depuis plusieurs régions en alternance ; issue après 3 échecs
consécutifs par défaut (≈ 15 min à 5 min d'intervalle), clos au premier succès ; **aucune
notification sans règle d'alerte**. Le service tourne chez Sentry, hors du projet Vercel : il voit
une suspension de projet.

Quota [S26] : tout plan Sentry inclut **un** moniteur Uptime et **un** moniteur Cron. Les suivants
se paient sur le budget à la demande, réservé aux plans payants (1,00 $ par moniteur Uptime et
0,78 $ par moniteur Cron, tarifs lus le 2026-11-14) ; sans budget suffisant, des moniteurs peuvent
être désactivés d'office. Le plan Sentry de l'organisation `klikandgo` n'a pas été relevé : à
vérifier par le propriétaire (point H).

Bot Protection Vercel pourrait défier les sondes : prévoir leur règle `bypass` avant activation
(`vercel-cost-performance` § 7). Sentry ajoute son propre `User-Agent`, dont la valeur n'est pas
donnée par la page lue.

## 4. Moniteurs de crons (corrige E14)

Ce que Vercel garantit [S27] : expressions en UTC ; **pas de nouvelle tentative** si le cron
échoue ; livraison « au mieux » (un passage peut manquer ou être doublé) ; précision à la minute
sur Pro, à l'heure près sur Hobby (un cron `0 1 * * *` y part entre 01:00 et 01:59).

`Sentry.withMonitor(slug, callback, config)` envoie `in_progress` puis `ok` / `error`, et crée ou
met à jour le moniteur depuis le code [S2]. Un check-in absent à l'heure prévue (plus la marge)
produit un événement d'erreur, **même si Vercel ne lance plus rien**. Compilé le 2026-11-14 :

```ts
import * as Sentry from "@sentry/nextjs";

export async function runCron<T>(slug: string, crontab: string, job: () => Promise<T>): Promise<T> {
  try {
    return await Sentry.withMonitor(slug, job, {
      schedule: { type: "crontab", value: crontab },   // recopié de vercel.json
      checkinMargin: 10,                                // minutes ; 60 si le plan Vercel est Hobby
      maxRuntime: 5,                                    // minutes
      timezone: "Etc/UTC",                              // les crons Vercel sont en UTC
      failureIssueThreshold: 1,
      recoveryThreshold: 1,
    });
  } finally {
    await Sentry.flush(2_000);
  }
}
```

- Placer l'appel **après** `verifyCronAuth` (`src/lib/cron-auth.ts`) : une requête non
  authentifiée ne doit pas produire de check-in.
- Le `slug` est stable (`cron-auto-cancel`) ; le `crontab` doit rester égal à `vercel.json`
  (test unitaire possible : lire `vercel.json` et comparer).
- `Sentry.flush` avant de rendre la réponse : par précaution sur une fonction qui peut être gelée
  après la réponse (non vérifié comme indispensable avec l'auto-instrumentation des route handlers).
- Le check-in passe en `error` seulement si le job lève (run entier en échec). Un échec d'item
  (une boutique, une commande) ne fait pas échouer le run : il produit un `logger.error` avec ids
  (donc un événement Sentry) et entre dans le compteur `failed` du résumé.
- `failureIssueThreshold: 1` : un cron quotidien manqué, c'est un jour de travail perdu que Vercel
  ne rejouera pas ; on veut le savoir dès le premier.
- Limite : 6 check-ins par minute et par environnement de moniteur [S2].
- Sans Sentry initialisé (local, mode test), `withMonitor` exécute simplement le job.

**Quel cron surveiller** (quota, § 3) : avec le seul moniteur inclus, `auto-cancel` — il porte un
effet métier (commandes `PENDING` expirées) et son absence prouve que la plateforme ne lance plus
aucun cron. Les crons suivants (`ready-reminder`, `recurring-orders`, puis le reste) attendent
l'arbitrage H ; d'ici là, leur échec **quand ils tournent** remonte déjà par `handleApiError` et
`logger.error`.

Alternative documentée : `_experimental.vercelCronsMonitoring: true` dans `withSentryConfig`
(lit `vercel.json`, fonctionne avec l'App Router ; l'ancienne `automaticVercelMonitors` ne couvre
que le Pages Router) [S2]. Elle crée un moniteur par chemin de cron — quinze chez nous — avec le
chemin pour `slug` (lecture de `server/vercelCronsMonitoring.js`) : à ne pas activer sans avoir
tranché F et H.

## 5. Mails de plateforme

Un e-mail de quota de Vercel doit déclencher une action, pas attendre d'être lu. Créer une
règle de boîte mail (expéditeurs Vercel, Railway, Sentry, GitHub « workflow disabled ») vers un
libellé notifié sur téléphone — action du propriétaire, à vérifier lors de chaque revue
trimestrielle (§ 6).

## 6. Revue trimestrielle (30 min)

- [ ] Le ou les moniteurs Uptime sont verts et ont alerté au moins une fois en test (URL
      volontairement fausse, puis remise).
- [ ] `gh workflow list` : `Uptime` est `active`.
- [ ] Moniteurs de crons : aucun « missed » ignoré ; aucun moniteur désactivé faute de budget.
- [ ] Sentry : issues non résolus > 30 jours triés (résolu, ignoré avec raison, ou ticket).
- [ ] Exercice de restauration fait ([sauvegardes-restauration.md](sauvegardes-restauration.md)).
- [ ] Variables de prod relues (Resend, Upstash, VAPID, `SENTRY_AUTH_TOKEN`) contre `health`.
