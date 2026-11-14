# Trafic automatisé : pare-feu, robots.txt, limitation de débit

Identifiants `S…` / `I…` : [sources.md](sources.md). Le site a été coupé alors que le trafic humain
était presque nul : sur un site peu visité, **les robots sont le trafic**. Deux fils de la
communauté Vercel décrivent le même profil : 359 clics en 28 jours pour plus d'un million de
requêtes CDN (S35), et un pic simultané d'invocations et de middleware sans utilisateurs réels (S36).

Ce fichier touche à l'exploration par les moteurs : **lire `seo-anti-penalty` avant toute action**
et ne rien changer à `src/app/robots.ts` sans passer par ce garde-fou.

## 1. Quatre lignes de défense, de la moins chère à la plus chère

| Ligne | Où | Coût d'une requête arrêtée | Limites |
| --- | --- | --- | --- |
| Pare-feu Vercel (règles, Bot Protection, limitation de débit, blocage IP) | avant le CDN | **0** : ni requête CDN, ni transfert (S18, S45) ; la requête n'atteint ni le middleware ni la fonction | 3 règles personnalisées par projet sur Hobby, 40 sur Pro (S3) |
| Page statique ou réponse en cache | CDN | 1 requête CDN, aucun calcul | ne protège pas les routes `ƒ` |
| `config.matcher` en liste blanche | middleware | rien pour ce qui n'est pas listé | les chemins `/api/*` authentifiés restent couverts |
| `checkRateLimit()` (`src/lib/rate-limit.ts`, Upstash) | dans la fonction | **une invocation est déjà payée**, plus une commande Redis | protège la base et les API tierces, pas la facture |

`robots.txt` n'est pas une défense : seuls les robots respectueux le lisent. Il reste utile pour eux
(`/api/`, `/boucher/`, `/checkout/`… sont interdits dans `src/app/robots.ts`, ce qui évite que les
robots d'exploration qui exécutent le JavaScript appellent nos API).

Bloquer un robot **dans le middleware** est un contresens de coût : le middleware a déjà tourné pour
lire l'agent utilisateur. Le pare-feu fait le même tri gratuitement (S18).

## 2. Ce que le pare-feu offre sur chaque plan

- **Gratuit sur tous les plans** : atténuation DDoS (toujours active), règles personnalisées,
  blocage d'IP, mode « Attack Mode » (défi pour tout le monde, à activer en cas d'attaque) (S18).
- **Bot Protection** (jeu de règles géré, tous plans, inactif par défaut) : modes `log` ou
  `challenge`. Met au défi le trafic qui n'est pas un navigateur, dont un `curl` qui se présente
  comme Chrome, et **exempte automatiquement les robots vérifiés** (S20). L'annuaire des robots
  vérifiés contenait le 2026-11-13 Googlebot, Bingbot, YandexBot, DuckDuckBot, Applebot, huit des
  neuf agents d'IA autorisés par `src/app/robots.ts` (GPTBot, OAI-SearchBot, ChatGPT-User,
  ClaudeBot, Claude-SearchBot, Claude-User, Google-Extended, PerplexityBot ; `Applebot-Extended`
  n'y figure pas sous ce nom, seul `applebot` y est), les webhooks Stripe et Svix (Svix livre ceux
  de Clerk), UptimeRobot, Sentry Uptime, Better Stack et Lighthouse (S20). La liste évolue : la
  relire avant de passer en `challenge`. Ne fonctionne pas derrière un proxy inverse comme
  Cloudflare (S20).
- **AI Bots** (jeu de règles géré, tous plans, « Allow » par défaut) : modes `log` ou `deny`, liste
  maintenue par Vercel, réglable séparément pour les robots d'entraînement et les assistants (S20,
  S39, S42). **Chez nous il reste sur Allow** : la règle GEO du propriétaire autorise ces robots
  (`src/app/robots.ts`, CLAUDE.md § GEO / AIO). Voir [points-a-arbitrer.md](points-a-arbitrer.md) § C.
- **Limitation de débit** (tous plans) : fenêtre fixe de 10 s à 10 min, clé IP ou empreinte JA4,
  action 429 par défaut (ou log, deny, challenge). Hobby : **1 règle**, comptée dans les 3, et
  1 million de requêtes autorisées incluses ; Pro : 40 règles, facturées au million de requêtes
  autorisées. Les compteurs sont tenus par région (S19).
- Toute action a un mode **Log** : l'activer d'abord, lire le trafic touché dans l'onglet Firewall,
  puis seulement bloquer (S19, S20).

## 3. Jeu de règles recommandé pour Klik&Go

À faire dans le tableau de bord (Firewall → Configure) ou avec `vercel firewall rules add …` puis
`vercel firewall publish` (S39). Ce n'est pas du code du dépôt : **consigner chaque règle publiée
dans la description de la PR ou dans `DEPLOY.md`**, sinon personne ne saura qu'elle existe.

1. **Refuser les chemins de scanners.** Aucune de nos routes ne se termine par `.php` ni ne
   commence par `/wp-`, `/.env`, `/.git`, `/xmlrpc`. Sans règle, ces requêtes tombent sur la 404
   statique : pas de fonction, mais une requête CDN chacune. Action `deny`.
2. **Limiter le débit sur `/api/`** : 1 règle, clé IP, par exemple 120 requêtes par minute, action
   429 (valeurs par défaut de Vercel : 100 requêtes par 60 s, S19). Le seuil doit rester au-dessus
   du polling légitime : une tablette cuisine fait 12 appels par minute, un suivi de commande 12,
   plusieurs postes d'une boucherie partagent la même IP, et des clients mobiles d'un même
   opérateur aussi. Exclure de la condition `/api/webhooks/`, `/api/payments/webhook` et
   `/api/cron/` (appels de serveur à serveur, en rafales). Commencer en mode Log et ne passer à 429
   qu'après avoir lu, dans l'onglet Firewall, qui aurait été limité. `checkRateLimit()` reste en
   place pour les limites métier fines (OTP, création de commande, IA).
3. **Bot Protection en `log`, puis `challenge`** après une semaine d'observation. Avant de passer à
   `challenge`, traiter deux effets de bord :
   - `.github/workflows/uptime.yml` sonde le site avec `curl` et un agent utilisateur Chrome :
     c'est exactement le profil mis au défi (S20). Ajouter une règle `bypass` dédiée (en-tête secret
     envoyé par le workflow) ou basculer la sonde vers un moniteur de l'annuaire vérifié
     (UptimeRobot, Sentry Uptime, Better Stack) ;
   - vérifier dans les journaux du pare-feu que les crons Vercel (`/api/cron/*`), les webhooks Clerk
     et Stripe et le cron `seo-audit` (qui requête le site lui-même, depuis une fonction : profil
     non-navigateur) ne sont pas touchés. Les webhooks Stripe et Svix sont dans l'annuaire vérifié,
     donc exemptés ; pour les crons Vercel et les appels du site vers lui-même, la documentation
     lue ne dit rien : c'est le mode `log` qui tranche.

Compte des règles sur Hobby (3 règles personnalisées par projet, dont 1 seule de limitation de
débit, S3, S19) : refus des scanners (1) + limitation de débit (1) + `bypass` de la sonde (1) = quota
plein. Bot Protection et AI Bots sont des règles gérées réservées (`bot-protection`, `ai-bots`),
listées à part des règles personnalisées (S39) : elles ne devraient pas consommer ce quota, à
confirmer dans le tableau de bord au moment de les activer.

Ce qu'il ne faut pas faire :

- bloquer par pays, par ASN ou par agent utilisateur générique sans passer par le mode Log : un
  blocage large peut toucher Googlebot ou Bingbot (mise en garde du fil S35), donc l'indexation ;
  après toute règle, vérifier qu'aucun robot de moteur n'apparaît dans le trafic refusé ou mis au défi ;
- refuser `GPTBot`, `ClaudeBot`, `PerplexityBot`, etc. : contraire à la règle GEO du propriétaire ;
- mettre un défi ou une limitation de débit sur `/api/webhooks/*`, `/api/payments/webhook` ou
  `/api/cron/*` ;
- compter sur la limitation Upstash pour protéger la facture.

## 4. Les crons et pings qui fabriquent du trafic robot

- `performance-refresh` réécrivait chaque boutique visible tous les jours, donc `Shop.updatedAt`,
  donc le `lastmod` du sitemap pour l'accueil, toutes les boutiques et les pages villes : invitation
  quotidienne à tout recrawler (I1). Règle : un `lastmod` ne bouge que si le contenu a changé ; une
  tâche de maintenance préserve `updatedAt`.
- `indexnow-fresh` soumet chaque jour environ 112 à 132 URL inchangées (I1). C'est une routine SEO
  voulue par le propriétaire : voir [points-a-arbitrer.md](points-a-arbitrer.md) § G.
- Les agents planifiés côté poste (audits quotidiens, GSC, Bing) et tout ancien service de ping
  décrit dans `DEPLOY.md` frappent la production comme n'importe quel robot. Avant d'en ajouter un,
  compter ses requêtes par jour et vérifier qu'il vise des pages statiques.

## 5. En cas d'emballement (CPU ou requêtes qui montent en flèche)

1. Tableau de bord → Usage : identifier le compteur qui monte (CPU, invocations, requêtes CDN).
2. Firewall → trafic par agent utilisateur, IP et chemin sur la dernière heure (en ligne de
   commande : `vercel firewall traffic list`, S39) ; Observability → Vercel Functions et Middleware
   pour les routes en tête.
3. Si une source unique domine : règle `deny` sur son IP ou son empreinte (gratuit, immédiat après
   publication). Si c'est diffus : limitation de débit, puis Attack Mode le temps de l'analyse.
4. Si la cause est interne (boucle de polling, reconnexion en boucle, cron) : corriger et déployer.
   Une boucle côté client continue tant que les onglets ouverts n'ont pas rechargé la page.
5. Sur Pro, vérifier que la pause automatique ne s'est pas déclenchée ; la reprise est manuelle,
   projet par projet (S7).
6. Noter la cause, le compteur et la règle posée dans un compte rendu d'incident (skill
   `reliability-observability`).
