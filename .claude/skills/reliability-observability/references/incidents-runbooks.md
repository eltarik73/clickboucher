# Incidents : conduite, runbooks, post-mortem

Une personne d'astreinte (le fondateur), des agents qui préparent. Règle : **d'abord rétablir le
service, ensuite comprendre**. L'agent ne bascule pas la prod, ne change pas une variable, ne paie
rien, ne supprime rien : il diagnostique, prépare les commandes, et le propriétaire exécute.

## 1. Conduite d'un incident (toutes causes)

1. **Constater depuis l'extérieur** : `curl -sI https://klikandgo.app/ | grep -i -E '^HTTP|x-vercel-error|x-vercel-cache'`
   et `curl -s https://klikandgo.app/api/health` (le détail par dépendance n'est servi qu'avec
   l'en-tête `Authorization: Bearer <CRON_SECRET>`, cible de `sante-et-surveillance.md` § 2).
2. **Ouvrir une note horodatée** (UTC) : ce qui est vu, ce qui est fait, par qui. Elle devient la
   chronologie du post-mortem.
3. **Délimiter** : tout le site ou une route ? depuis quel déploiement ? (Sentry : release ;
   Vercel : Deployments).
4. **Atténuer** par l'action la plus réversible : rollback, pause d'une boutique, désactivation
   d'un cron — avant tout correctif de code.
5. **Prévenir** les bouchers concernés si des commandes sont touchées (téléphone / message), et
   vérifier les commandes en cours dans le tableau cuisine.
6. **Clore** quand la sonde externe est verte depuis 30 min ; post-mortem si un déclencheur du § 3
   est atteint.

## 2. Runbooks

### R1 — Le site renvoie 402 / 5xx partout

| Symptôme | Cause probable | Action |
| --- | --- | --- |
| `402` + `x-vercel-error: DEPLOYMENT_DISABLED` [S23] | quota dépassé, projet mis en pause, ou retour au plan Hobby | tableau Vercel → Usage / Billing ; lever la pause (plan, budget) — propriétaire ; puis `vercel-cost-performance` pour la cause CPU |
| `5xx` après un déploiement | régression | **Instant Rollback** vers un déploiement de production antérieur [S22] ; attention : après un rollback, les pushes sur `main` ne passent plus en prod tant qu'on n'a pas promu un déploiement (bouton « Manage » ou `vercel promote`) [S22] |
| `5xx` sur les API seulement, pages en cache OK | base ou dépendance | R2 / R3 |
| `504` + `x-vercel-error: MIDDLEWARE_INVOCATION_TIMEOUT` [S23] | middleware qui n'a pas répondu en 25 s (appel externe sans délai) | logs Vercel (filtre resource = middleware) ; Redis lent (R3) ou Clerk |

Un rollback ramène le **code**, pas la base ni les variables : il ne défait pas une migration
Prisma (l'ancien code doit tolérer le schéma courant — `prisma-expert`, migrations en deux temps)
et le déploiement restauré garde les variables de sa construction [S22].

### R2 — Base injoignable ou saturée

Signes : `health.db = "fail"`, Sentry P1001 / P1017 / P2024 (une fois E8 corrigé ; avant, chercher
« DB Connection Error » dans les logs Vercel, conservés 1 h à 1 jour selon le plan [S8]).
1. Tableau Railway : service Postgres en ligne ? CPU, disque plein, connexions.
2. P2024 en rafale = pool épuisé : un handler qui ouvre trop de requêtes parallèles, une requête
   longue ou une transaction longue. Ne pas toucher aux paramètres de l'URL sous la pression :
   `prisma-expert` (connexions-serverless.md, point A2).
3. Disque plein : agrandir le volume (Railway) ; ne pas supprimer de données sous la pression.
4. Corruption ou suppression : [sauvegardes-restauration.md](sauvegardes-restauration.md) § 5.

### R3 — Redis / Upstash lent ou en panne

Signes : `health.redis = "fail"`, `[redis] … failed` en masse, middleware lent. Le site doit
continuer (cache manqué, rate limit fail-open). Si le middleware ralentit tout : vérifier que
`edgeRedis` a bien un délai (E11). En dernier recours, retirer les variables Upstash de Vercel et
redéployer coupe Redis proprement (mais aussi le rate limit) — décision du propriétaire.

### R4 — « Le client (ou le boucher) n'a rien reçu »

1. `/api/health` et variables de prod : Resend, VAPID présents ?
2. Logs : `[email]` / `[push]` autour de l'heure, par `orderId` (pas par e-mail).
3. Resend : tableau de bord, statut du message (bounce, domaine non vérifié).
4. Push : abonnement expiré (404/410) → supprimé ? Le boucher a-t-il autorisé les notifications ?
5. Pour le boucher, le filet est le tableau cuisine (polling) : vérifier qu'il était ouvert.
Détail du pipeline : `background-jobs-notifications`.

### R5 — Un cron ne tourne plus

Signes : moniteur Sentry « missed », ou effet métier absent (commandes `PENDING` jamais expirées).
Rappel : Vercel ne relance pas un cron en échec, et un passage peut manquer sans laisser de log [S27].
1. Vercel → onglet Cron Jobs du projet : présent ? désactivé ? (le réglage « Disable Cron Jobs »
   survit aux rollbacks et aux promotions [S22]) ; bouton « View Logs » du cron.
2. Appel manuel authentifié depuis le poste du propriétaire (il exécute vraiment le cron ; nos
   crons sont faits pour être rejoués) :
   `curl -H "Authorization: Bearer $CRON_SECRET" https://klikandgo.app/api/cron/auto-cancel`.
3. 401 → le secret envoyé ne correspond pas : `CRON_SECRET` modifié sans redéploiement, absent de
   Production, ou caractère invalide dans la valeur [S27] ; 404 → route supprimée ou renommée ;
   504 → dépasse la limite de la fonction ; aucune trace → règle de pare-feu qui bloque
   `vercel-cron/1.0`, ou réponse en redirection (un cron ne suit pas les redirections) [S27].

### R6 — Secret exposé (commit, log, capture d'écran)

Révoquer et remplacer chez le fournisseur **d'abord**, puis redéployer, puis nettoyer. Détail et
liste des secrets : `security-multitenant`. Exemple réel : le mode test ouvert en production
jusqu'au 2026-11-13 (CLAUDE.md « Test Mode »).

## 3. Post-mortem

Déclencheurs, définis à l'avance comme le demande [S7] (les types viennent de [S7], les seuils
et le dernier sont fixés par ce skill) : indisponibilité visible > 15 min ; toute perte de
données ; rollback ou intervention manuelle en prod ; incident découvert **sans** alerte
(échec de la surveillance) ; commande client perdue ou facturée faux.

Principes [S7] : sans blâme (on corrige des systèmes, pas des personnes) ; relu (« un post-mortem
non relu pourrait aussi bien ne pas exister ») ; actions suivies ; rangé dans un dépôt partagé.
Règles maison (non tirées de [S7]) : écrit sous 5 jours ouvrés ; chaque action a un responsable
et une échéance.

Le dépôt est **public** : un post-mortem n'y contient ni secret, ni donnée personnelle, ni détail
exploitable d'une faille encore ouverte (ceux-là restent chez le propriétaire).

Gabarit (à copier dans `docs/postmortems/AAAA-MM-JJ-titre.md` — dossier à créer au premier usage) :

```markdown
# <Titre> — <date>
## Résumé (3 lignes) : quoi, combien de temps, qui a été touché
## Impact : utilisateurs, commandes, chiffre, SEO, données
## Chronologie (UTC) : début, détection, atténuation, résolution
## Détection : comment l'a-t-on su ? combien de temps après le début ?
## Causes : techniques et organisationnelles (pourquoi les garde-fous n'ont pas joué)
## Ce qui a bien marché / ce qui a manqué
## Actions : [ ] action — responsable — échéance — lien PR/ticket
```

## 4. Cas d'école : panne de novembre 2026 (post-mortem rédigé a posteriori)

Sources : CLAUDE.md (« Coût CPU Vercel », « CI/CD »), commentaires de `.github/workflows/uptime.yml`,
`git log`, notes du propriétaire (détail au registre privé du programme). Mesures chiffrées
(CPU, invocations) : `vercel-cost-performance`, references/panne-2026-11-05.md — ne pas les recopier ici.

**Résumé.** Du 2026-11-05 17:13 UTC au 2026-11-13, l'équipe Vercel a été suspendue : klikandgo.app,
comme tous les projets de l'équipe, a répondu `402 DEPLOYMENT_DISABLED`.
Cause : quota « Fluid Active CPU » dépassé alors que le trafic humain était quasi nul.

**Impact.** Près de 8 jours sans commande possible ; pages SEO en 402 pour Googlebot (risque de
désindexation) ; crons métier (expiration des commandes, rappels) arrêtés ; aucune perte de données
connue.

**Chronologie.**
- 2026-04-29 — commit `27ea77b` : `<ClerkProvider dynamic>` rend 298 routes sur 308 dynamiques.
- 2026-06-12 — dernier commit avant la panne.
- 2026-08-31 — GitHub désactive un workflow planifié du dépôt (« Claude Security Review ») pour
  inactivité [S12] : une sonde GitHub aurait été coupée de la même façon.
- 2026-11-05 17:13 — suspension.
- 2026-11-13 — service rétabli, correctifs `a43002d` … `161f920` déployés et vérifiés ; sonde
  `uptime.yml` ajoutée.

**Détection.** Aucune alerte automatique, à aucun moment. Toute l'observabilité (Sentry, crons
d'audit SEO) dépendait du projet suspendu ; il n'y avait aucune sonde hors plateforme ; aucun
avertissement de la plateforme n'a été transformé en alerte (détail : registre privé du programme).

**Causes.**
- Techniques : `config.matcher` du middleware attrape-tout ; `ClerkProvider dynamic`
  (fonctions à chaque page, `revalidate` inopérant) ; des exécutions dues pour l'essentiel aux
  robots et aux crons, pas à des clients.
- Organisationnelles : pas de sonde hors plateforme ; pas de budget ni de seuil d'alerte lu ;
  rien dans la CI ne vérifiait que les pages restaient prérendues.

**Ce qui a manqué / ce qui aurait suffi.** Une sonde Sentry Uptime (hors Vercel) aurait ouvert un
issue ≈ 15 min après la suspension [S3] ; un moniteur de cron aurait signalé le premier check-in
manqué de la nuit [S2] ; un filtre de boîte mail aurait fait remonter les avertissements de quota.

**Actions.**
- [x] Matcher en liste blanche + test ; `dynamic` retiré ; appels anonymes supprimés ; garde CI
      `check-prerender.mjs` (CLAUDE.md).
- [x] `uptime.yml` (filet, limité par la règle des 60 jours).
- [ ] Sentry Uptime sur `/api/health` + règle d'alerte prouvée par un test — propriétaire
      (second moniteur sur `/` selon l'arbitrage H).
- [ ] Moniteur Sentry Crons sur `auto-cancel` (`runCron`) — équipe ; les autres selon H.
- [ ] Filtre mail Vercel / Railway / Sentry / GitHub — propriétaire.
- [ ] Seuil de dépense ou d'usage Vercel avec notification — propriétaire
      (`vercel-cost-performance`, point B).
- [ ] Revue trimestrielle ([sante-et-surveillance.md](sante-et-surveillance.md) § 6) — propriétaire.
