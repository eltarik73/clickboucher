---
name: klikgo-programme
description: Manuel du programme Klik&Go — comment un chantier est mené en autonomie du brief à la fusion dans main. Chaîne de commandement (propriétaire, directeur de programme, chef de chantier, ingénieurs, testeur de recette, relecteur et auditeurs indépendants), politique de modèles (Opus produit, Fable contrôle), modèle de brief, attribution de fichiers disjoints, règles contre le rafistolage, définition de terminé commune, décisions réservées au propriétaire, conventions de commit, recette sur serveur local seedé, passation entre phases, et table « type de travail → skills à lire ».
when_to_use: Lancer, découper, planifier, relire ou clore un chantier ; écrire un brief ; répartir des fichiers entre ingénieurs ; décider si un travail est terminé ; savoir quoi remonter au propriétaire ; préparer un commit ou une fusion ; monter la recette locale (Postgres Docker, build de production, mode test) ; choisir les skills à lire pour une tâche ; rôle klikgo-* (chef de chantier, ingénieur, recette, relecteur, auditeur, designer, référenceur).
---

# Programme Klik&Go — manuel du chantier

Ce manuel dit **comment** on travaille. Le **quoi** (règles techniques) est dans les skills de
domaine (§ 11) et dans `CLAUDE.md`. Ordre de précédence, du plus fort au plus faible :

1. les messages du propriétaire dans la conversation ;
2. `CLAUDE.md` du dépôt (relire le fichier **sur disque** : la copie injectée en début de session
   peut être périmée, erreur déjà commise) ;
3. `seo-anti-penalty` (garde-fou du propriétaire) pour tout ce qui touche l'indexation ;
4. ce manuel et les skills de domaine.

Une contradiction entre ces textes ne se tranche pas en code : « Points à arbitrer » du livrable.
Celles déjà connues : [references/contradictions-connues.md](references/contradictions-connues.md).

## 1. Chaîne de commandement

| Rôle                     | Fiche (`.claude/agents/`)             | Modèle              | Rend compte à    | Écrit dans le dépôt ?                                    |
| ------------------------ | ------------------------------------- | ------------------- | ---------------- | -------------------------------------------------------- |
| Propriétaire (fondateur) | —                                     | —                   | —                | décide seul du § 8                                       |
| Directeur de programme   | session principale                    | celui de la session | propriétaire     | lance les fiches, fusionne dans `main`                   |
| Chef de chantier         | `klikgo-chef-de-chantier`             | fable               | directeur        | plan, revue ; pas de code produit                        |
| Ingénieur backend        | `klikgo-ingenieur-backend`            | opus                | chef de chantier | ses fichiers seulement                                   |
| Ingénieur front          | `klikgo-ingenieur-front`              | opus                | chef de chantier | ses fichiers seulement                                   |
| Ingénieur plateforme     | `klikgo-ingenieur-plateforme`         | opus                | chef de chantier | ses fichiers seulement                                   |
| Designer                 | `klikgo-designer`                     | opus                | chef de chantier | ses fichiers seulement                                   |
| Référenceur              | `klikgo-referenceur`                  | opus                | chef de chantier | ses fichiers seulement                                   |
| Testeur de recette       | `klikgo-testeur-recette`              | opus                | chef de chantier | tests seulement, jamais le code produit                  |
| Greffier                 | pas de fiche (lancé par le directeur) | opus                | directeur        | commits de travail sur la branche, aucun fichier modifié |
| Relecteur indépendant    | `klikgo-relecteur`                    | fable               | **directeur**    | non (lecture seule)                                      |
| Auditeur sécurité        | `klikgo-auditeur-securite`            | fable               | **directeur**    | non (lecture seule)                                      |

- **Directeur** : fixe les priorités, écrit le brief, **lance chaque fiche** (une tâche par appel,
  avec le brief, le plan et le chemin du rapport), transmet les rapports, arbitre, fusionne.
- **Chef de chantier** : vérifie les défauts dans le code avant de planifier, découpe en tâches à
  fichiers disjoints, relit tout, **refuse ce qui n'est pas au niveau**, signe la clôture ; ne
  délègue pas la qualité au contrôle. Il **écrit** les tâches : c'est le directeur qui lance les
  ingénieurs (un sous-agent n'a pas toujours l'outil Agent [AN2]), sauf délégation explicite.
- **Ingénieurs, designer, référenceur** : exactement leur tâche, dans leurs fichiers. **Recette** :
  prouve le comportement sur le serveur local, décrit l'écart ; le chef réassigne la correction.
- **Relecteur et auditeur** : indépendants du chef ; leur rapport va au directeur, qui peut
  bloquer la fusion. Ils ne corrigent pas eux-mêmes.
- **Remontée** : ingénieur → chef (`besoinsDuChef`) → directeur → propriétaire (§ 8). Désaccord
  entre le chef et un contrôle : le directeur tranche par écrit ; un constat bloquant qui touche
  une règle de `CLAUDE.md` ou le § 8 ne se lève pas sans le propriétaire.

## 2. Politique de modèles (décision du propriétaire, 2026-11-13)

- **Opus produit** : ingénieurs, designer, référenceur, recette, greffier, et les corrections
  demandées par un contrôle. **Fable contrôle** : chef de chantier (plan et revue), relecteur,
  auditeur sécurité, contrôle final.
- **Rien n'est commité sur `main` sans un contrôle par un rôle Fable** ; les commits de travail
  sur la branche du chantier sont permis, la fusion ne l'est qu'après le feu vert Fable.
- Le champ `model` des fiches porte l'alias (`opus`, `fable`). Un `model` passé à l'appel de
  l'agent prime sur la fiche, et `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` l'ignorerait [AN2] : ne
  passer que le même alias, ne pas poser cette variable.

## 3. Cycle d'un chantier

| Phase                   | Qui                                                                                              | Entrée                                | Sortie (passation, § 12)                                        | Porte de sortie                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0. Brief                | directeur                                                                                        | plan du programme                     | brief ([modèle](references/brief-template.md))                  | périmètre, critères, fichiers possédés écrits                          |
| 1. Plan                 | chef (fable)                                                                                     | brief                                 | plan : défauts vérifiés, tâches par couches, fichiers par tâche | aucun fichier dans deux tâches d'une même couche                       |
| 2. Réalisation          | ingénieurs (opus), puis greffier                                                                 | leur tâche                            | code + tests + rapport d'ingénieur ; couche commitée            | portes locales vertes sur leurs fichiers                               |
| 3. Recette              | testeur (opus)                                                                                   | commit de la branche + critères       | rapport de recette par critère                                  | chaque critère « constaté » ou écart décrit                            |
| 4. Revue du chef        | chef (fable)                                                                                     | diff complet + recette                | corrections exigées ou accord                                   | rien en dessous du niveau ; recette refaite après corrections          |
| 5. Contrôle indépendant | `klikgo-relecteur` (+ `klikgo-auditeur-securite` si route, auth, donnée personnelle ou paiement) | diff + rapports                       | constats classés                                                | aucun constat bloquant ou majeur ouvert (audit : ni critique ni haute) |
| 6. Contrôle final       | `klikgo-relecteur`, nouvelle instance                                                            | branche propre, corrections commitées | feu vert ou corrections                                         | DoD § 7 rejouée par le contrôleur lui-même                             |
| 7. Fusion               | directeur                                                                                        | feu vert                              | squash dans `main`                                              | portes rejouées par le directeur                                       |
| 8. Après déploiement    | directeur                                                                                        | production                            | vérification en lecture seule                                   | pages clés 200, prérendu intact, Sentry calme                          |

- On ne construit **jamais** une couche sur une couche incomplète : une tâche perdue se relance.
- Chaque livrable validé est **écrit sur disque** avant de répondre (les sessions se coupent :
  crédits, veille, réseau). À la reprise, on saute ce qui est déjà livré et vérifié.
- Deux chantiers en parallèle au plus, chacun dans **son** worktree, **sa** base et **son** port.
- Un contrôle qui trouve un défaut bloquant ou majeur renvoie à la phase 2 pour **ce** défaut
  (corrigé par un ingénieur Opus), puis la recette et le contrôle concernés sont rejoués.

## 4. Le brief

Modèle : [references/brief-template.md](references/brief-template.md). Un brief sans **critères
d'acceptation testables**, sans **fichiers possédés**, sans **hors périmètre** ou sans
**environnement** (worktree, branche, base, port, dossier de travail) est renvoyé au directeur.
Il cite les constats (fichier et ligne) et les skills à lire (§ 11) ; le chef revérifie chaque
constat dans le code avant de planifier (le dépôt bouge).

## 5. Attribution des fichiers

- **Un fichier = un ingénieur par couche.** Deux tâches d'une même couche ont des fichiers
  disjoints ; un fichier peut revenir dans une couche suivante avec une spécification explicite.
  La couche 1 contient ce sur quoi les autres s'appuient (types, service, schéma, migration).
- **Fichiers partagés** (`package.json`, `package-lock.json`, `.github/workflows/ci.yml`,
  `CLAUDE.md`, `vitest.config.ts`, `next.config.mjs`, `src/middleware.ts`, `vercel.json`,
  `prisma/schema.prisma`) : modifiés seulement si le plan le dit, de façon minimale et additive,
  chaque modification listée dans le rapport.
- Un besoin hors de ses fichiers, ou une erreur de type dans le fichier d'un autre ingénieur de
  la même couche : **ne pas y toucher**, l'écrire dans `besoinsDuChef`.
- **Un seul build à la fois par worktree** (`.next` y est partagé) : un ingénieur ne lance
  `next build`, `next dev` ou `next start` que si sa tâche le lui attribue nommément ; sinon le
  build et le serveur reviennent à la recette et aux contrôles.

## 6. Règles contre le rafistolage

Déjà violées ici pour la plupart (« Erreurs déjà commises » des skills) ; le relecteur les refuse.

1. **Corriger la cause**, pas le symptôme : dite au rapport, prouvée par un test rouge puis vert.
2. **Aucun `try/catch` qui cache une erreur** : politique de `reliability-observability` § 2
   (relancer, ou journaliser avec un identifiant métier) ; jamais `catch {}` ni `return []`.
3. **Aucune valeur par défaut qui masque une donnée absente** (`?? 0` sur un prix, origine
   `FRANCE` par défaut du schéma affichée comme un fait, liste vide si la base ne répond pas,
   figée dans le cache ISR). Une absence est un état explicite du type, traité à l'écran.
4. **Aucun faux succès** : un transport qui n'a rien envoyé ne renvoie pas `true`.
5. **Aucun TODO, aucun code mort, aucun code commenté, aucun `.bak`**, aucun `console.log`,
   aucun `any` sans commentaire de justification.
6. **Fichiers petits** : moins de 300 lignes ; un fichier déjà au-dessus ne grossit pas, on en
   extrait (`architecture-conventions` § 6–7).
7. **Une seule autorité par règle** : prix (`src/lib/pricing/*`), statut de commande
   (`src/lib/services/orders/transition.ts`), heure de Paris (`src/lib/paris-time.ts`), horaires
   (`src/lib/shop-hours.ts`), auth (helpers de `CLAUDE.md`). Chercher l'existant avant d'écrire.
8. **Le serveur ne croit pas le navigateur** pour l'argent, l'identité, la propriété, le statut.
9. **Pas de mock de Prisma** ; ce qui touche la base se prouve en intégration sur PostgreSQL réel.
10. **Pas de réécriture opportuniste** : rien hors brief, pas de refactor mêlé à un correctif.
11. **Aucune dépendance npm nouvelle** sans qu'elle soit nommée et justifiée dans le plan.

## 7. Définition de terminé (commune à tout chantier)

S'ajoute à la DoD de chaque skill de domaine. Le contrôle final la rejoue lui-même.

- [ ] Cause identifiée et corrigée ; test vu **rouge** avant le correctif, **vert** après.
- [ ] Tests écrits au bon niveau (`testing-strategy` § 2) : unitaire pour le pur, intégration sur
      base réelle pour toute écriture, cas « autre boutique » pour toute route à identifiant,
      test de course pour toute action concurrente.
- [ ] `npx tsc --noEmit` ; `npm run lint` ; `npm run test` ; `npm run test:integration` (base
      locale) ; `npm run build` sur base joignable puis `node scripts/check-prerender.mjs`
      (par le rôle qui tient le build, § 5) : verts.
- [ ] Aucune règle de `CLAUDE.md` enfreinte (relue sur disque), notamment « Coût CPU Vercel »,
      tenant dans chaque requête, helpers d'auth, Zod sur chaque mutation.
- [ ] Comportement **constaté** sur le serveur local seedé en mode test, pour chaque rôle concerné
      et sans session ; captures 375 px clair/sombre si l'interface change.
- [ ] § 6 respecté (le relecteur a cherché : `catch`, `??`, `||`, `TODO`, `console.`, `any`).
- [ ] États des lieux des skills touchés (`references/etat-du-code.md` et équivalents) mis à
      jour si un écart est fermé ou découvert, ou mise à jour demandée au directeur.
- [ ] Rapports de phase écrits (§ 12) ; points à arbitrer listés, aucun tranché en code.

## 8. Ce qui revient toujours au propriétaire

Un chantier **prépare** (document, script avec mode simulation, PR prête) ; le propriétaire
**déclenche**. Jamais tranché par un agent, même si un skill le recommande :

- **Indexation** : balise robots, `noindex`, `robots.ts`, sitemap (ensemble d'URL), canonical d'un
  gabarit, soumissions GSC/Bing/IndexNow manuelles, pages programmatiques (`seo-anti-penalty`).
- **Textes légaux** : CGV, CGU, mentions légales, politique de confidentialité, bandeau cookies,
  libellé du bouton de commande, tout point marqué [JURISTE] (`conformite-france`).
- **Prix et argent** : prix, commission, frais de service, remises, règles de fidélité, seuils
  d'ajustement, activation du paiement en ligne (`stripe-payment` § 1).
- **Règles métier et périmètre produit** : annulation, client absent, code de retrait, réglage
  par défaut visible du client, retrait d'un écran ou d'une fonctionnalité, montée de version
  majeure (Next, React, Clerk, Prisma).
- **Services payants** : nouveau fournisseur, plan Vercel/Sentry/Upstash, crons infra-quotidiens
  qui exigent un plan, toute dépense. **Remplacer Clerk** : exclu (décision du propriétaire).
- **Données utilisateur** : suppression ou anonymisation de données réelles, dépublication d'une
  boutique, envoi à des personnes réelles (campagne, e-mail, SMS).
- **Production** : toute commande contre la base de production, les variables Vercel, les
  secrets (rotation, création), les comptes (Clerk, Stripe, Resend).
- **Tout « Point à arbitrer »** d'un skill et toute décision ouverte du plan du programme. Le
  brief (§ 8 du modèle) dit lesquelles sont prises, avec leur date ; sans date, la décision
  n'est pas prise. Dans le doute : c'est au propriétaire.

Dépôt **public** : aucun constat de faille non corrigée, aucun secret, aucune URL de base, aucun
rapport d'audit brut dans un fichier commité. Ces rapports restent hors dépôt.

## 9. Git et commits

Détail (hooks, message, greffier, fusion) : [references/git-et-commits.md](references/git-et-commits.md).

- Une branche par chantier (`programme/<id>-<nom>`), **locale** : `vercel.json` ne coupe la
  preview que pour `claude/**` et `dependabot/**`, donc une branche `programme/**` poussée
  lancerait une preview Vercel qui échoue faute de base. Seul `main` déploie, en production.
- Ingénieurs, designer, référenceur, recette, relecteur, auditeur : **aucune commande git qui
  modifie l'état** (add, commit, stash, checkout, reset, merge, rebase, push) ; seule exception,
  le worktree jetable de la recette (fiche `klikgo-testeur-recette`, étape 6).
- Seul le **greffier** commite sur la branche du chantier : un agent lancé par le directeur après
  chaque couche et chaque série de corrections (ou le chef, si le directeur le lui confie), par
  chemins explicites (`git add -- <chemins>`, jamais `git add -A`). **Seul le directeur pousse**,
  et fusionne en **squash** dans `main` après le feu vert Fable (§ 2).
- Message `type(portée): sujet` (imposé par `.husky/commit-msg`), sujet en français, corps qui dit
  **pourquoi**. `pre-commit` lance `lint-staged` : `--no-verify` interdit, un échec se corrige
  dans le code.
- Migration : additive, compatible avec le code N-1 (la production migre pendant que l'ancienne
  version sert), rejouable, avec `rollback.sql` et `preflight.sql` en lecture seule, commitée avec
  `prisma/schema.prisma` (modèle : `prisma/migrations/20261113120000_chantier0_order_integrity/`).

## 10. Recette locale (préproduction sur la machine)

Aucune préproduction en ligne (Preview Vercel sans base, `CLAUDE.md`). Pas à pas et limites :
[references/recette-locale.md](references/recette-locale.md). En bref : (1) PostgreSQL jetable
dans le conteneur Docker local, **base et port donnés par le brief**, base recréée dans le
conteneur (jamais `migrate reset` ni `db push --force-reset`), schéma poussé puis seed ;
(2) **build de production** (`npm run build`, qui exige la base) puis `check-prerender.mjs` ;
(3) `next start` avec `TEST_MODE=true`, `ALLOW_TEST_IN_PROD=true` et un `TEST_SECRET` aléatoire
(≥ 16 caractères, hors de tout fichier suivi) ; (4) session ouverte par
`POST /api/test-mode/activate { secret, role }`, qui pose un **jeton signé** de 8 h ; poser des
cookies à la main ne marche plus. Le mode test ne prouve **aucune isolation** entre boutiques.
Vers `klikandgo.app` : GET seulement.

## 11. Quels skills lire pour quel travail

Toujours : `CLAUDE.md`, ce manuel, `architecture-conventions`, `testing-strategy`. Index de tous
les skills : [`../README.md`](../README.md).

| Travail                                                            | Skills à lire (dans l'ordre)                                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Route API nouvelle ou modifiée                                     | `api-route-conventions`, `security-multitenant`, `prisma-expert`, `clerk-auth` si auth ; `vercel-cost-performance` si cache ou hors matcher |
| Schéma, migration, requête, transaction, compteur                  | `prisma-expert`, `security-multitenant`                                                                                                     |
| Statuts de commande, cuisine, échéances, temps réel                | `order-lifecycle-realtime`, `click-and-collect`, `prisma-expert`, `vercel-cost-performance`                                                 |
| Parcours client (boutique, panier, créneau, checkout, suivi)       | `click-and-collect`, `ux-marketplace`, `design-klikgo`, `accessibility-wcag`, `conformite-france` (bouton de commande, prix)                |
| Nouvelle page, rendu, ISR, layout, `"use client"`                  | `nextjs-app-router`, `vercel-cost-performance`, `web-performance` ; pages publiques : `seo-anti-penalty`, `seo-expert`                      |
| Composant ou écran                                                 | `design-klikgo`, `accessibility-wcag`, `ux-marketplace` ; `web-performance` si dépendance client                                            |
| Auth, rôles, middleware, mode test                                 | `clerk-auth`, `security-multitenant`, `vercel-cost-performance` (matcher), `nextjs-app-router`                                              |
| Cron, e-mail, push, WhatsApp, campagne                             | `background-jobs-notifications`, `reliability-observability`, `conformite-france` (consentement), `vercel-cost-performance`                 |
| Paiement en ligne                                                  | `stripe-payment`, `order-lifecycle-realtime`, `security-multitenant`, `conformite-france`                                                   |
| SEO, JSON-LD, sitemap, pages villes                                | `seo-anti-penalty` d'abord, `seo-expert`, `nextjs-app-router`, `conformite-france` (allégations)                                            |
| Performance front, images, polices, `sw.js`                        | `web-performance`, `nextjs-app-router`, `vercel-cost-performance`                                                                           |
| Coût Vercel, middleware, cache, polling, `vercel.json`             | `vercel-cost-performance`, `nextjs-app-router`                                                                                              |
| Erreurs, logs, Sentry, santé, incident, sauvegardes                | `reliability-observability`, `background-jobs-notifications` (crons)                                                                        |
| Données personnelles, cookies, analytics, avis, prix barrés, halal | `conformite-france`, puis le propriétaire (§ 8)                                                                                             |
| Refactor, découpage, déplacement de fichiers                       | `architecture-conventions`, `testing-strategy`                                                                                              |
| Tests, CI, E2E                                                     | `testing-strategy`, `accessibility-wcag` (axe)                                                                                              |
| Audit de sécurité                                                  | `security-multitenant`, `clerk-auth`, `api-route-conventions`                                                                               |

## 12. Passation entre phases

Chaque phase écrit son rapport **sur disque** (hors dépôt) et le renvoie ; la phase suivante part
du fichier, pas d'un souvenir. Il dit ce qui a été **vérifié** (commande, résultat) et ce qui ne
l'a pas été ; un écart va dans `ecarts`, un besoin hors périmètre dans `besoinsDuChef`, une
décision du propriétaire dans `pointsAArbitrer`. Les rôles en lecture seule renvoient leur
rapport, le directeur l'enregistre. Champs par rôle et gravités qui bloquent la fusion :
[passation-et-rapports.md](references/passation-et-rapports.md).

## 13. Points à arbitrer (propriétaire)

- **P1 Push** : `CLAUDE.md` (« Permissions ») autorise commit et push sans demander ; ce manuel
  réserve le push au directeur après feu vert Fable (appliqué aux agents de chantier).
- **P2 Dépôt public** : tout constat de faille non corrigée et tout fait de configuration de
  production restent hors dépôt (registre privé du programme) ; une revue de publication précède
  tout commit de `.claude/skills/` sur `main`.
- **P3 Plan et quotas d'hébergement** : à confirmer par le propriétaire (état actuel : voir le
  registre privé du programme).
- **P4 Écarts de `CLAUDE.md`** relevés par les skills : [contradictions-connues.md](references/contradictions-connues.md) § 2.

Sources : [references/sources.md](references/sources.md).
