# Facturation Vercel : compteurs, plans, dépassements

Chiffres lus le 2026-11-13 (identifiants `S…` : [sources.md](sources.md)). Prix en USD hors taxes.
Relire la page source avant de chiffrer une décision.

## 1. Quel code déclenche quel compteur

| Ce qui se passe | Compteurs touchés | Dans notre code |
| --- | --- | --- |
| Toute requête reçue, même servie depuis le cache ou en 404 statique | **CDN Requests** (ex « Edge Requests ») + **Fast Data Transfer** (S12) | pages, `_next/static`, images, robots.txt, scans de robots |
| Le middleware s'exécute | **CPU actif** + **mémoire** au modèle Fluid (S13) ; le **Fast Origin Transfer** peut être compté deux fois pour une même requête (S12) | `src/middleware.ts`, uniquement les chemins de `config.matcher` |
| Une fonction s'exécute : route API, page `ƒ`, régénération ISR, cron | **Invocation** + **CPU actif** + **mémoire provisionnée** + **Fast Origin Transfer** (S2, S12) | 198 fichiers `src/app/api/**/route.ts`, `/boutique/[slug]`, `/suivi/[id]`, 15 crons |
| Une page ISR est relue hors du cache CDN régional | **ISR Reads** (unités de 8 KB) (S14) | 23 pages avec `revalidate`, environ 290 chemins prérendus |
| Une page ISR est régénérée et son contenu a changé | **ISR Writes** (unités de 8 KB) + la fonction ci-dessus (S14) | idem ; pas d'écriture facturée si le HTML est identique |
| `next/image` produit une variante absente ou périmée | **Image Transformations** + **Image Cache Writes** (S15) | `next.config.mjs` : 13 largeurs, qualités 60 à 80 dans les composants |
| Le routage du CDN dépasse 10 ms de CPU pour une requête | **CDN Request CPU Duration**, par tranches de 10 ms (S12) | 11 redirections, 1 réécriture, en-têtes globaux : négligeable aujourd'hui |
| `<Analytics />` et `<SpeedInsights />` envoient un événement | **Web Analytics Events** (facturés sur Pro), **Speed Insights Events** (quota gratuit, voir § 2) (S1, S43, S44) | `src/app/layout.tsx`, sur chaque page vue |
| Un build | minutes de build (incluses sur Hobby ; 0,0035 $ par minute-CPU sinon) (S1) | `npm run build` prérend environ 290 pages en interrogeant la base |
| Une requête bloquée, mise au défi ou limitée par le pare-feu | **rien** : ni requête CDN ni transfert (S18, en vigueur depuis mai 2026 : S45) | aucune règle consignée dans le dépôt ; l'état réel se lit dans le tableau de bord |

Trois conséquences à garder en tête :

1. **Le CPU actif ne compte pas l'attente** (requête Prisma, appel Upstash, Resend). 100 ms de
   calcul et 400 ms d'attente = 100 ms facturés (S2 ; modèle annoncé en juin 2025, S31). En revanche la **mémoire provisionnée est
   facturée pendant toute la durée de la requête**, attente comprise, jusqu'à la fin de la dernière
   requête en cours sur l'instance (S2). Une connexion longue (SSE, streaming) facture donc de la
   mémoire en continu : 2 GB tenus ouverts 24 h = 48 GB-h par jour.
2. **Le middleware s'exécute avant le cache** (S13, S32). Une réponse API servie en HIT par le CDN
   paie quand même le middleware si son chemin est dans le matcher. Notre middleware tourne sur le
   runtime Edge (seul possible en Next 14, S32) ; Vercel le facture au modèle Fluid (S13).
3. **À faible trafic, presque chaque invocation est un démarrage à froid.** Mesures de l'audit :
   0,2 à 0,4 ms de CPU à chaud pour le middleware contre 46 à 54 ms à froid ; charger
   `@sentry/nextjs` coûte environ 209 ms de CPU, Clerk 56 ms, Resend 81 ms, Prisma 20 ms (I1).
   Le coût se pilote donc d'abord par le **nombre d'invocations**, ensuite par le poids des imports.

## 2. Hobby et Pro côte à côte

| Ressource (par mois) | Hobby : inclus, puis blocage | Pro : à la demande (région Paris `cdg1`) | Source |
| --- | --- | --- | --- |
| CPU actif (Fluid) | 4 h | 0,177 $ / h (même prix en `sfo1` ; 0,128 $ en `iad1`) | S2, S3, S5 |
| Mémoire provisionnée | 360 GB-h | 0,0146 $ / GB-h (`sfo1` : 0,0147 $) | S2, S3 |
| Invocations de fonctions | 1 000 000 | 0,60 $ / million | S3, S11, S30 |
| Requêtes CDN | 1 000 000 | Flat Rate CDN inclus : 1 M de requêtes + 1 TB ; au-delà palier à 20 $ (10 M, 50 TB) | S3, S6 |
| Fast Data Transfer | 100 GB | couvert par le Flat Rate CDN | S3, S6 |
| Fast Origin Transfer | 10 GB | 0,06 $ / GB | S3, S5 |
| Écritures / lectures ISR | non listé (voir « non vérifié » dans sources.md) | 4,80 $ / 0,48 $ par million d'unités de 8 KB | S5 |
| Transformations d'images | 5 000 | 0,0626 $ / millier | S3, S5 |
| Lectures / écritures du cache d'images | 300 000 / 100 000 | 0,48 $ / 4,80 $ par million | S3, S5 |
| Web Analytics | 50 000 événements ; au-delà, 3 jours de grâce puis collecte suspendue (reprise au cycle suivant selon S44, après 7 jours selon S3) | 0,03 $ / millier, rien d'inclus | S1, S3, S44 |
| Speed Insights | gratuit : 10 000 événements sur 30 jours glissants, partagés par l'équipe ; au-delà, collecte suspendue au moins 14 jours | gratuit dans la même limite ; les 0,65 $ / 10 000 événements ne s'appliquent qu'à l'option « Plus » (10 $ par projet et par mois) | S1, S3, S43 |
| Crons `vercel.json` | 100 par projet, **1 fois par jour**, précision ± 59 min | 100 par projet, à la minute | S8 |
| Règles WAF personnalisées / IP bloquées | 3 / 10 | 40 / 40 | S3 |
| Règle de limitation de débit | 1 (comptée dans les 3), 1 M de requêtes autorisées incluses | 40, 0,60 $ / million de requêtes autorisées | S19, S5 |
| Mémoire et CPU d'une fonction | 2 GB / 1 vCPU (fixe) | 2 GB / 1 vCPU par défaut, 4 GB / 2 vCPU max | S10 |
| Durée max d'une fonction | 300 s | 300 s par défaut, 800 s max | S3, S10 |
| Journaux d'exécution | 1 heure | 1 jour | S3 |
| Spend Management | indisponible | disponible | S3, S7 |
| Usage commercial | **interdit** | autorisé | S25, S37 |

Pro = 20 $ par mois (1 siège qui déploie) incluant **20 $ de crédit d'usage** valable sur tous les
compteurs, non reportable (S4). Les sièges « Viewer » sont gratuits.

Les quotas Hobby sont alloués **à l'équipe**, pas au projet (S10 parle de l'allocation mensuelle
des équipes Hobby ; S3 le précise pour Speed Insights) : la consommation des autres projets de
l'équipe réduit d'autant le budget de Klik&Go (inventaire de l'équipe : registre privé du programme).

## 3. Ce qui se passe au dépassement

**Hobby.** Pas de facture : la ressource est coupée, en général jusqu'à ce que 30 jours se soient
écoulés (S3). Pour le CPU ou les invocations, le site répond `402 DEPLOYMENT_DISABLED` (S24) : c'est
la panne du 2026-11-05. Pour les images, seules les nouvelles variantes échouent en 402, les
anciennes restent servies (S15). Spend Management n'existe pas sur ce plan (S3) : aucun seuil
d'alerte n'est réglable, Vercel envoie seulement des e-mails à l'approche d'un quota (S15 le dit
pour les images). Sortie rapide documentée par Vercel : passer en Pro (S24).

**Pro.** Rien n'est coupé : l'usage au-delà du crédit est facturé. Vercel prévient à 75 % du crédit,
puis envoie des récapitulatifs quotidiens et hebdomadaires (S4). Le garde-fou est **Spend
Management** (S7) :

- un « On-Demand Budget » par cycle de facturation ; il ne couvre ni les sièges ni les options ;
- notifications web et e-mail à 50, 75 et 100 %, SMS à 100 % ;
- option **Pause Production Deployments** : à 100 %, la production de **tous les projets de
  l'équipe** passe en `503 DEPLOYMENT_PAUSED` ; la reprise est **manuelle, projet par projet**,
  même après avoir relevé le budget ;
- le contrôle a lieu « toutes les quelques minutes » : la dépense peut dépasser le budget avant la
  pause, il faut régler le budget sous le maximum acceptable ;
- webhook `budget.reached` signé (`x-vercel-signature`, HMAC-SHA1) ;
- en ligne de commande : `vercel billing budgets`, `vercel billing budgets inspect`,
  `vercel billing budgets set --amount 50 --pause --webhook https://…` (S7).

Fixer un budget ne stoppe rien sans l'option de pause : c'est une alerte, pas un plafond (S7). À
l'inverse, un changelog de juin 2024 annonce que la pause est **activée par défaut** quand on crée
un budget (S40) ; la page actuelle (S7) ne le répète pas. Après toute création ou modification de
budget, relire l'interrupteur « Pause Production Deployments » dans Settings → Billing : il coupe
tous les projets de l'équipe. Par défaut, Vercel n'active pour un nouveau client Pro qu'une
notification à 200 $ par cycle (S4).

## 4. Crons : limites par plan

- `vercel.json` (fonctionnalité qualifiée de « legacy » par Vercel) : 100 crons par projet sur tous
  les plans. Sur Hobby, une expression qui tourne plus d'une fois par jour **fait échouer le
  déploiement**, et l'heure n'est garantie qu'à l'heure près (`0 1 * * *` part entre 01:00 et 01:59)
  (S8). Nos 15 entrées sont quotidiennes, hebdomadaires ou mensuelles pour cette raison (commits
  `c397ec2` et `c04bd28`).
- Chaque exécution est une invocation de fonction facturée comme les autres (S8). Nos 15 entrées
  (13 quotidiennes, 1 hebdomadaire, 1 mensuelle) pèsent moins de 450 invocations par mois :
  négligeable. Ce qui coûte, c'est ce qu'un cron **provoque** : `seo-audit` fait 20 requêtes sur le
  site ; un cron qui modifie `Shop.updatedAt` change le `lastmod` du sitemap et invite les robots à
  tout recrawler (I1). Parade en place : `refreshShopMetrics(shopId, keepUpdatedAt)` dans
  `src/lib/services/performance.ts` repasse la valeur lue de `updatedAt` dans `data`, ce qui
  empêche `@updatedAt` de la changer. Faire de même pour toute écriture technique sur `Shop`.
- Convention du dépôt : chaque route de cron exporte `dynamic = "force-dynamic"` et appelle
  `verifyCronAuth(req)` en première ligne du `try` (modèle : `src/app/api/cron/auto-cancel/route.ts`).
  `maxDuration` exporté par la route prime sur les 30 s de `vercel.json` (S23).
- Les routes `/api/cron/*` sont exclues du matcher (`src/lib/cron-auth.ts` vérifie
  `Authorization: Bearer $CRON_SECRET`). Les heures de `vercel.json` sont en **UTC**.
- Un cron ne tourne pas quand le projet est suspendu : il ne peut pas servir de sonde de
  disponibilité (voir le skill `reliability-observability`).
- Vercel Schedules (bêta) autorise une exécution toutes les 15 minutes sur Hobby, dans la limite de
  5 000 exécutions par période (S9). Fonctionnalité en bêta : ne pas bâtir dessus sans arbitrage ;
  le sujet appartient au skill `background-jobs-notifications`.

## 5. Région

`vercel.json` fixe `"regions": ["sfo1"]`, à côté de la base Railway, documentée en US-West par
`RAPPORT-PERFORMANCE-RAILWAY.md` (région à confirmer dans le tableau de bord Railway). Le CPU coûte le même
prix à `sfo1` et à `cdg1` (S2) : la région est une décision de **latence**, pas de coût. Les requêtes
CDN et le transfert sont tarifés selon la région d'où vient le visiteur (S12) ; le cache ISR durable
suit la région des fonctions (S14). Ne jamais déplacer les fonctions sans déplacer la base (et
Upstash) dans la même version.
