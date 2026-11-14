# Recette locale — préproduction sur la machine

État au 2026-11-14. Il n'y a **pas** de préproduction en ligne : l'environnement Preview de
Vercel n'a pas de `DATABASE_URL` et les branches `claude/**` / `dependabot/**` ne s'y déploient
pas (`vercel.json`, `CLAUDE.md` « Vercel preview »). La production est en lecture seule pour les
agents (GET seulement : ni formulaire, ni commande, ni compte). La recette tourne donc sur un
**build de production local**, branché sur un **PostgreSQL jetable** rempli par le seed, avec le
**mode test** activé par un jeton signé.

## 1. Principes

- **Une base, un port, un worktree et un dossier de travail par chantier, donnés par le brief**
  (§ 9 du modèle). Ne jamais les choisir soi-même. Deux chantiers ne partagent ni base ni
  `node_modules` (un client Prisma régénéré par l'un casse l'autre).
- **Ne toucher qu'à sa base.** Le conteneur `klikgo-verify-pg` sert tout le programme : il
  contient les bases des autres chantiers. Une base
  de travail en plus se nomme `<db>_<suffixe>` et se supprime à la fin. Tout autre conteneur de la
  machine appartient à un autre travail : ne pas y toucher.
- La base est **jetable** : conteneur local, hôte `127.0.0.1`. Jamais la base de production,
  jamais une base distante. `.env` et `.env.*` ne sont **jamais** lus : toutes les variables
  viennent du fichier de variables de la recette (étape 3), écrit hors du dépôt.
- Aucune commande Prisma destructive : ni `prisma migrate reset`, ni `db push --force-reset`, ni
  la variable de consentement « dangerous AI action ». On recrée la base dans le conteneur.
- `TEST_SECRET` est aléatoire, d'au moins 16 caractères, et n'apparaît dans **aucun** fichier
  suivi par git (`CLAUDE.md` « Test Mode »), ni dans un rapport.
- **Un seul build à la fois par worktree** : `.next` y est partagé, et un `next build` lancé
  pendant que `next start` sert casse le serveur. Arrêter le serveur avant de reconstruire. Le
  build et le serveur reviennent à la recette et aux contrôles (manuel § 5).
- **L'outil Bash d'un agent ne garde ni variables ni dossier courant d'un appel au suivant** :
  chaque commande recharge le fichier de variables et part de la racine du worktree du chantier.
  Ne pas faire `cd` vers un autre worktree : `git -C <dossier>` ou un sous-shell
  `( cd <dossier> && … )`.
- Sous-agents (constaté le 2026-11-14 dans l'application de bureau) : leurs outils d'écriture de
  fichiers ne fonctionnent que dans le worktree principal de la session et dans le scratchpad.
  C'est le directeur qui crée le worktree d'un second chantier, dans le scratchpad.

## 2. Monter la recette

Depuis la racine du worktree du chantier. À remplacer partout : `<db>` (base du chantier :
minuscules, chiffres, `_`), `<port>`, `<work>` (chemin absolu du dossier de travail, hors dépôt).

```bash
# 1. Conteneur PostgreSQL du programme : le réutiliser s'il existe, sinon le créer
if docker ps -a --format '{{.Names}}' | grep -qx klikgo-verify-pg; then
  docker start klikgo-verify-pg
else
  docker run -d --name klikgo-verify-pg -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci \
    -e POSTGRES_DB=ci -p 127.0.0.1:55433:5432 postgres:15-alpine
fi

# 2. Base du chantier, recréée à neuf (sans commande Prisma destructive). <db> = celle du brief.
docker exec klikgo-verify-pg psql -U ci -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS <db> WITH (FORCE)" -c "CREATE DATABASE <db> OWNER ci"

# 3. Fichier de variables, écrit UNE fois hors du dépôt (droits 600), rechargé à chaque commande
( umask 077
  {
    echo "export DATABASE_URL='postgresql://ci:ci@127.0.0.1:55433/<db>?schema=public'"
    echo 'export DIRECT_DATABASE_URL="$DATABASE_URL"'
    echo "export CLERK_SECRET_KEY='sk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk'"
    echo "export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk'"
    echo "export NEXT_PUBLIC_SITE_URL='https://klikandgo.app'"
    echo "export NEXT_PUBLIC_APP_URL='http://localhost:<port>'"
    echo "export NEXT_TELEMETRY_DISABLED=1"
    echo "export TEST_SECRET='$(openssl rand -hex 24)'"
    echo "export CRON_SECRET='$(openssl rand -hex 16)'"
    echo "unset VERCEL_ENV"
  } > "<work>/recette-vars.sh" )

# 4. Client Prisma, schéma, seed (le seed VIDE la base visée : jamais ailleurs que sur <db>)
. "<work>/recette-vars.sh" && npx prisma generate && npx prisma db push --skip-generate \
  && npx prisma db seed

# 5. Build de production (≈ 290 pages prérendues interrogent la base) + garde de prérendu
. "<work>/recette-vars.sh" && npm run build && node scripts/check-prerender.mjs

# 6. Serveur de production en arrière-plan, mode test autorisé, puis attente de /api/health
. "<work>/recette-vars.sh" && TEST_MODE=true ALLOW_TEST_IN_PROD=true \
  nohup npx next start -p <port> > "<work>/recette-server.log" 2>&1 &
curl -s -o /dev/null -w '%{http_code}\n' --retry 30 --retry-delay 2 --retry-connrefused \
  http://localhost:<port>/api/health        # 200 attendu ; sinon lire recette-server.log
```

Notes, vérifiées dans le dépôt :

- Les clés Clerk et l'URL du site sont celles de `.github/workflows/ci.yml` (factices, format
  valide). Les identifiants `ci` / `ci` et le port `55433` ne valent que pour ce conteneur local.
- L'image `postgres:15-alpine` est celle présente sur la machine ; la CI utilise
  `postgres:16-alpine`. Ne pas télécharger une autre image sans que le brief le dise.
- `TEST_MODE` et `ALLOW_TEST_IN_PROD` ne sont posés qu'au **démarrage** du serveur, jamais au
  build. `unset VERCEL_ENV` garantit que le build fige `KLIKGO_DEPLOY_ENV=local`
  (`next.config.mjs`) : avec `production`, le mode test resterait fermé quoi qu'on fasse.
- `npm run build` lance `prisma generate`, puis `scripts/prisma-migrate-prod-only.mjs`, qui ne
  migre rien hors production Vercel : le schéma local vient de `db push`.
- Le seed passe par `npx tsx`, qui n'est pas installé dans `node_modules` : npm le télécharge au
  premier appel (réseau requis).
- Reconstruire après une correction : arrêter le serveur (§ 6), puis étapes 5 et 6. Remettre les
  données à zéro : arrêter le serveur, puis étapes 2 et 4 (inutile de refaire l'étape 3).

## 3. Ouvrir une session de test

Depuis `2364ef9` (2026-11-13), le serveur ne croit qu'un **jeton signé** (HMAC-SHA256, rôle et
expiration 8 h) posé dans le cookie httpOnly `klikgo-test-session` par
`src/app/api/test-mode/activate/route.ts`. Les cookies `klikgo-test-activated` et
`klikgo-test-role` ne sont que des indices d'interface. Un pot de cookies par rôle, gardé dans
`<work>` :

```bash
. "<work>/recette-vars.sh"
JAR="<work>/jar-boucher.txt"
curl -s -c "$JAR" -X POST http://localhost:<port>/api/test-mode/activate \
  -H 'content-type: application/json' -d "{\"secret\":\"$TEST_SECRET\",\"role\":\"BOUCHER\"}"
curl -s -b "$JAR" http://localhost:<port>/api/boucher/orders/pending-count          # appel authentifié
curl -s -b "$JAR" -c "$JAR" -X PATCH http://localhost:<port>/api/test-mode/activate \
  -H 'content-type: application/json' -d '{"role":"CLIENT"}'                        # changer de rôle
curl -s -b "$JAR" -X DELETE http://localhost:<port>/api/test-mode/activate          # fermer
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:<port>/api/cron/auto-cancel   # un cron, à la main
```

Rôles acceptés : `CLIENT`, `BOUCHER`, `ADMIN` (toute autre valeur donne `CLIENT`). Ne pas utiliser
la variante `GET ?secret=…` de la route : elle met le secret dans une URL. Dans Playwright :
`context.request.post("/api/test-mode/activate", { data: { secret, role } })`, puis
`storageState` par rôle (`testing-strategy`, `references/playwright-e2e.md`).

Vérifié le 2026-11-14 sur un serveur de recette en marche : sans session, une route protégée
répond 401, `PATCH` répond 403 « No active test session », et un `POST` avec un mauvais secret
répond 403 « Invalid secret ».

## 4. Ce que la recette locale prouve, et ce qu'elle ne prouve pas

| Prouvé                                                            | Non prouvé (le dire dans le rapport)                                                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build de production, prérendu, routes `○`/`●`/`ƒ`                 | Comportement derrière pgbouncer ; écart de version PostgreSQL (15 en local, 16 en CI)                                                                                          |
| Parcours anonymes, pages publiques, zéro appel API au montage     | Vrai login Clerk : avec les clés factices, clerk-js ne se charge pas                                                                                                           |
| Parcours par rôle en mode test (CLIENT, BOUCHER, ADMIN)           | **Isolation entre boutiques** : le mode test court-circuite middleware et propriété ; l'isolation se prouve en intégration avec les vrais helpers (`testing-strategy` règle 4) |
| Réponses API, statuts, `OrderEvent` relus en base                 | Une autre boutique que la première : les jetons BOUCHER et ADMIN visent **toujours la plus ancienne boutique** (« El Fathe » dans le seed)                                     |
| Crons appelés à la main avec `Authorization: Bearer $CRON_SECRET` | Planification réelle Vercel, quotas, CPU facturé                                                                                                                               |
| E-mails et push : appel du transport (journal)                    | Délivrabilité réelle : elle dépend de la configuration de production, hors de portée de la recette                                                                             |
| Refus par validation (400), par rôle (401/403), par état (409)    | Limitation de débit : non testable sur la recette (pas de Redis local)                                                                                                         |

## 5. Vérifications typiques d'une recette

- Chaque critère du brief : **constaté** (commande + sortie, ou capture) ou **écart** décrit.
- Chaque route touchée : 200 avec le bon rôle, 401 sans session, 403/404 avec un mauvais rôle.
- Écran touché : 375 px clair et sombre, 320 px, clavier seul ; tablette paysage pour la cuisine.
- Vue anonyme en navigation privée : aucune requête `/api/*` au montage d'une page publique.
- Base relue après chaque action (`docker exec klikgo-verify-pg psql -U ci -d <db> -c '…'`).
- Tests d'intégration : `. "<work>/recette-vars.sh" && npm run test:integration`. Ils tournent
  dans le schéma `itest` de `<db>` et ne touchent pas les données du seed (schéma `public`).

## 6. Fin de chantier

```bash
lsof -tiTCP:<port> -sTCP:LISTEN | xargs kill                      # arrêter le serveur du chantier
docker exec klikgo-verify-pg psql -U ci -d postgres \
  -c "DROP DATABASE IF EXISTS <db> WITH (FORCE)"                   # supprimer SA base, et elle seule
```

Supprimer aussi les bases `<db>_<suffixe>` créées en plus, `<work>/recette-vars.sh` et les pots de
cookies. **Ne pas supprimer le conteneur** `klikgo-verify-pg` : il sert aux autres chantiers ; le
directeur seul décide de l'arrêter.
