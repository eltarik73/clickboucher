# Modèle de brief de chantier

Le directeur remplit ce modèle ; le chef de chantier le renvoie s'il manque une rubrique marquée
(obligatoire). Le brief est un fichier hors dépôt (dossier de travail du chantier) : il peut citer
des constats de sécurité non corrigés, qui ne doivent pas entrer dans un dépôt public.

```markdown
# Chantier <ID> — <nom court>

## 1. Pourquoi (obligatoire)

Le problème vu par l'utilisateur ou le boucher, en deux ou trois phrases. Impact (argent, sécurité,
disponibilité, conversion, conformité). Pourquoi maintenant.

## 2. Constats à traiter (obligatoire)

| Id  | Fichier:ligne (au commit <sha>) | Constat | Preuve (test, commande, capture) |
| --- | ------------------------------- | ------- | -------------------------------- |

Le chef revérifie chaque ligne dans le code actuel avant de planifier.

## 3. Périmètre

- Dans le périmètre : …
- Hors périmètre (obligatoire) : … (ce qu'on ne touche pas, même si c'est tentant)
- Chantiers voisins et coutures : ce qu'un autre chantier livre ou attend de celui-ci.

## 4. Fichiers possédés (obligatoire)

- Possédés (création et modification libres dans la tâche assignée) : chemins ou motifs.
- Partagés autorisés (modification minimale et additive, listée au rapport) : …
- Interdits : tout le reste.

## 5. Critères d'acceptation (obligatoire, testables)

| #   | Critère observable | Comment le constater (test, requête, écran, rôle) |
| --- | ------------------ | ------------------------------------------------- |

Chaque critère dit l'état attendu ET le cas d'échec (sans session, autre boutique, rejeu, course).

## 6. Skills à lire

Liste tirée de la table du § 11 de `klikgo-programme`, plus la DoD de chaque skill cité.

## 7. Contraintes

- Migrations : oui / non ; si oui, additive, compatible N-1, `rollback.sql` + `preflight.sql`.
- Dépendances npm : aucune, sauf : … (nom, version, raison).
- Fichiers partagés touchés : …
- Effet attendu sur le coût Vercel (invocations, CPU) : …

## 8. Décisions du propriétaire

- Déjà prises (avec date) : …
- En attente (le chantier n'y touche pas, ou prépare seulement) : …

## 9. Environnement (obligatoire)

- Worktree (chemin absolu) et branche du chantier : …
- Base de comparaison `<base>` (commit ou branche d'où part le chantier, pour `git diff <base>...HEAD`) : …
- Base locale `<db>` et port `<port>` de la recette (voir `recette-locale.md`) : …
- Dossier de travail `<work>` (chemin absolu, hors dépôt : rapports, variables de recette, captures) : …
- Qui tient le build et le serveur (par défaut : la recette et les contrôles) : …
- Qui commite (par défaut : un greffier lancé par le directeur) : …

## 10. Livrables

Code + tests sur la branche ; rapports de phase ; mise à jour des états des lieux des skills
concernés ; note de passation pour les chantiers suivants.
```

## Contrôle du brief par le chef (avant le plan)

- [ ] Chaque constat retrouvé dans le code actuel (sinon : retiré du plan, signalé au directeur).
- [ ] Chaque critère est vérifiable par quelqu'un d'autre que l'auteur du code.
- [ ] Aucun critère ne demande une décision du § 8 de `klikgo-programme` qui ne soit pas listée
      « déjà prise (avec date) » au § 8 du brief.
- [ ] Les fichiers possédés couvrent tous les critères ; sinon, demande d'extension au directeur.
- [ ] Le hors périmètre est explicite.
- [ ] L'environnement (§ 9) est complet : worktree, branche, `<base>`, `<db>`, `<port>`, `<work>`.
