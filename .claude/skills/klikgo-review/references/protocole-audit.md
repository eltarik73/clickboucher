# Protocole de relecture et d'audit

Pas à pas de `/klikgo-review` et de l'audit de pureté du code. Les règles (gravité, passes, ce
qu'on ne signale pas) sont dans `SKILL.md` ; ce fichier donne les gabarits à coller dans les
prompts des sous-agents, parce qu'un sous-agent ne charge pas un skill de façon fiable.

## Sommaire

1. Préparer : base, diff, contexte
2. Gabarits des quatre relecteurs
3. Découpage de l'audit par répertoire
4. Gabarit du validateur
5. Schéma du rapport
6. Recherches en lecture seule
7. Outils en lecture seule des skills vérifiés

## 1. Préparer : base, diff, contexte

Depuis la racine du dépôt. Rien de ce qui suit n'écrit dans le dépôt.

```bash
BASE=$(git merge-base HEAD main)            # ou la base passée à /klikgo-review
git rev-parse --verify "$BASE" >/dev/null   # base introuvable : s'arrêter et le dire
git rev-parse --short HEAD && git status --short
git diff --stat "$BASE"...HEAD              # vide : s'arrêter et le dire
git log "$BASE"..HEAD --oneline
git diff "$BASE"...HEAD -- src tests prisma scripts .github   # lu en entier ; sortie tronquée : fichier par fichier
```

- Relire `CLAUDE.md` sur disque (la copie injectée en début de session peut être périmée).
- Chercher le brief du chantier (dossier de travail donné par le directeur). Absent : le noter, il
  servira à l'axe brief (R4) et à `nonVerifie`.
- Lister les fichiers de test touchés à part : ils sont relus en premier (un test affaibli cache
  le reste).
- Ne pas lancer de build si un autre tourne dans le même worktree (`klikgo-programme` § 5).

## 2. Gabarits des quatre relecteurs

En-tête commun, à coller tel quel dans chaque prompt, suivi du bloc propre au relecteur :

```text
Tu relis du code de Klik&Go. Branche [branche], base [sha], tête [sha].
Diff : git diff [base]...HEAD. Pour chaque fichier touché, lis aussi le code autour des lignes
changées et les appelants utiles.
Lecture seule : aucun fichier du dépôt modifié, aucune commande git qui change l'état, rien publié
sur GitHub ; fichiers temporaires hors du dépôt. Lis CLAUDE.md sur disque.
Ne rapporte que ce que tu peux prouver : fichier:ligne, règle citée mot pour mot avec sa section
(ou odeur nommée, « odeur possible »), scénario entrée → mauvais résultat, preuve.
Pas ce que lint, tsc, Prettier ou la CI imposent ; pas « ajouter des tests » sans scénario ;
au plus deux remarques de style. « Aucun constat » est une réponse valide.
Distingue régression (lignes du diff) et préexistant (hors du diff).
Gravité : bloquant / majeur / mineur, définitions ci-dessous. Une course sans entrelacement
fichier:ligne par fichier:ligne n'est pas un constat.
Termine par nonJuge (ce que tu as laissé de côté, une ligne et la raison chacune) et
auditAvantConclusion (fichiers lus en entier, passes faites sans constat, zones non vérifiées).
[coller SKILL.md § 2 et § 7]
```

**R1 — axe règles : conception, périmètre, échecs silencieux, performance.**

```text
Passes 1, 3, 4, 5 de SKILL.md § 4, et la table de SKILL.md § 5.
Pour chaque requête Prisma qui reçoit un identifiant venu de l'appelant : le where porte-t-il
shopId (ou le propriétaire) ? Un garde d'écriture est-il dans la même transaction ?
Pour chaque catch, .catch ou valeur par défaut : quelle ligne de la politique
reliability-observability § 2 s'applique ? Quelles erreurs peut-il avaler ?
Pour chaque requête nouvelle : volume parcouru, take, index, boucle.
[coller SKILL.md § 4 passes 1, 3, 4, 5 et § 5]
```

**R2 — axe règles : types, React, tests, odeurs, commentaires.**

```text
Passes 6 à 10 de SKILL.md § 4. Lis les fichiers de test séparément du code : pour chaque test
touché, quelle modification du code le ferait échouer ? Un test supprimé, sauté (.skip, .only,
.todo) ou dont l'assertion a été affaiblie est majeur.
Odeurs : toujours « odeur possible », avec l'alternative plus simple ; la règle du dépôt l'emporte.
[coller SKILL.md § 4 passes 6 à 10 et § 6]
```

**R3 — exactitude et copies.**

```text
Passes 2 et 11 de SKILL.md § 4. Pour chaque changement, cherche l'entrée qui le casse :
0 centime, liste vide, null, autre boutique, sans session, rejeu de la même idempotencyKey,
double clic, deux requêtes concurrentes, heure de Paris (changement d'heure, minuit), clés de
jour françaises, bornes (1 et 99 portions, 50 000 g).
Pour chaque correctif, cherche le même prédicat ou le même littéral dans tout src, sortie non
tronquée, et liste les copies non corrigées.
```

**R4 — axe brief.**

```text
Brief : [chemin ou texte, ou « absent »]. Pour chaque critère d'acceptation : tenu, partiel ou
absent, avec la ligne du brief citée et la preuve dans le diff. Liste ce que le diff fait sans
que le brief le demande. Sans brief : juge le diff contre l'intention des messages de commit et
écris « brief absent ». Ne juge pas le style ni les règles du projet : c'est l'autre axe.
```

En audit (pas de diff), remplacer « Diff » par « Périmètre : [répertoire] » et, pour R4, le brief
par le contrat documenté du module (section de `CLAUDE.md`, skill de domaine, commentaires d'en-tête).

## 3. Découpage de l'audit par répertoire

Un lot = un répertoire, relu par R1 à R4 puis validé. Ordre : du plus grand impact au plus petit
(argent et statuts d'abord, auth ensuite), pour que les constats qui comptent arrivent en premier.

| Ordre | Lot                                                                                            | Skills de domaine à coller en plus                                 |
| ----- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | `src/lib/services/orders`, `src/lib/pricing`, `src/lib/cart`                                   | `order-lifecycle-realtime`, `click-and-collect`                    |
| 2     | `src/lib/auth`, `src/lib/boucher-auth.ts`, `src/lib/admin-auth.ts`, `src/middleware.ts`        | `clerk-auth`, `security-multitenant`                               |
| 3     | `src/app/api` (par sous-dossier : `orders`, `boucher`, `admin`, `webmaster`, `cron`, le reste) | `api-route-conventions`, `security-multitenant`                    |
| 4     | reste de `src/lib` (notifications, transports, cache, SEO)                                     | `reliability-observability`, `background-jobs-notifications`       |
| 5     | pages publiques et ISR (`src/app/(client)`, pages villes, `sitemap.ts`)                        | `nextjs-app-router`, `vercel-cost-performance`, `seo-anti-penalty` |
| 6     | `src/app/(boucher)`, `src/app/(admin)`, `src/app/webmaster`                                    | `architecture-conventions` § 7                                     |
| 7     | `src/components`, `src/hooks`                                                                  | `react-patterns`, `accessibility-wcag`                             |
| 8     | `tests/`                                                                                       | `test-discipline`, `testing-strategy`                              |

Rayon d'impact d'un constat : nombre de fichiers qui importent le module fautif, compté sans
tronquer :

```bash
rg -l "from \"@/lib/[module]\"" src | wc -l
```

Constat mécanique répété (même motif dans plusieurs fichiers) : un seul constat qui liste les
emplacements et propose l'outil (règle ESLint, test de garde comme
`tests/lib/order-writers-guard.test.ts`), à préparer selon `quality-gates`.

## 4. Gabarit du validateur

Un validateur par constat candidat, contexte neuf, mêmes outils en lecture seule.

```text
Constat à réfuter : [une phrase : fichier:ligne, entrée, mauvais résultat, règle citée].
Ta tâche est de le réfuter. Lis le code cité, ses appelants, les gardes en amont (helper d'auth,
schéma Zod, where, transaction), les tests existants. Tu peux lancer une commande qui n'écrit
rien, une requête sur la recette locale (klikgo-programme/references/recette-locale.md), une
relecture en base locale. Jamais vers klikandgo.app autre chose qu'un GET.
Rends : verdict (confirmé | plausible | rejeté), preuve (commande et sortie, ou lignes lues),
et pour plausible ce qui le confirmerait. Rends aussi la gravité que tu retiendrais (bloquant
exige une entrée atteignable et un mauvais résultat montrés).
```

Règle de sortie : `rejeté` retiré (compté dans le rapport), `plausible` plafonné à `majeur`,
`confirmé` gardé à la gravité la plus basse proposée par le relecteur et le validateur quand ils
diffèrent, avec les deux raisons.

## 5. Schéma du rapport

```json
{
  "role": "relecteur",
  "commit": "abc1234 (+ git status --short résumé)",
  "verdict": "feu vert | feu vert sous réserve | refus",
  "constats": [
    {
      "gravite": "bloquant | majeur | mineur",
      "axe": "règles | brief",
      "fichier": "src/...",
      "ligne": 42,
      "regle": "citation mot pour mot — CLAUDE.md, section",
      "odeur": "ou : nom de l'odeur (sans règle)",
      "probleme": "une phrase",
      "scenario": "entrées → mauvais résultat",
      "preuve": "commande et sortie, ou lignes lues",
      "correctionAttendue": "ce qui lèvera le constat, et le test attendu",
      "validation": "confirmé | plausible (ce qui le confirmerait)",
      "origine": "régression | préexistant"
    }
  ],
  "reglesVerifiees": [{ "regle": "", "methode": "", "resultat": "" }],
  "portes": [{ "commande": "npx tsc --noEmit", "resultat": "0 erreur" }],
  "nonJuge": ["zone — raison"],
  "auditAvantConclusion": {
    "fichiersLusEnEntier": [],
    "passesSansConstat": [],
    "zonesNonVerifiees": []
  },
  "nonVerifie": [],
  "pointsAArbitrer": [],
  "rejetes": 0
}
```

Pour `/klikgo-review`, afficher ce contenu dans le terminal, axe règles puis axe brief puis
`préexistant`, chaque liste triée par gravité. En audit, le directeur l'enregistre dans le dossier
de travail, hors dépôt.

## 6. Recherches en lecture seule

Points de départ, jamais des constats en soi : chaque résultat se lit dans son contexte et passe
par la validation. Sortie complète, jamais tronquée.

```bash
rg -n "\.catch\(\(\) => \{\}\)" src                      # promesse dont l'erreur est jetée
rg -n -U "catch\s*(\([^)]*\))?\s*\{\s*\}" src            # catch vide
rg -n "\?\? \[\]|\?\? 0\b|\|\| \[\]" src                 # valeur par défaut : a-t-elle l'air d'une donnée ?
rg -n "as unknown as|: any\b|as any\b|@ts-(ignore|expect-error|nocheck)" src
rg -n "eslint-disable" src                               # chaque ligne a-t-elle sa raison ?
rg -n "console\.(log|error|warn)" src/app/api src/lib    # logger attendu
rg -n "setInterval\(" src                                # useVisiblePolling attendu
rg -n "\.(only|skip|todo)\(" src tests                   # test mis de côté
rg -n "vi\.mock\(\"@/lib/prisma\"" src tests             # interdit pour tout nouveau test
rg -n "TODO|FIXME" src
git diff "$BASE"...HEAD -- '*.test.ts' '*.test.tsx' '*.spec.ts'   # tests relus en premier
```

## 7. Outils en lecture seule des skills vérifiés

À lancer depuis la racine du dépôt. Leur sortie invite à lire le code ; ce n'est pas une preuve.

| Commande                                                                         | Ce qu'elle signale                                               | Passe |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| `python3 -I .claude/skills/reliability-observability/scripts/audit-catches.py .` | `catch` vides ou muets, par zone                                 | 4     |
| `node .claude/skills/prisma-expert/scripts/query-audit.mjs --quiet`              | `findMany` sans `take`, Prisma dans une boucle, `skip`, SQL brut | 5     |
| `node .claude/skills/vercel-cost-performance/scripts/cost-audit.mjs`             | régressions de coût Vercel (rendu dynamique, appel au montage)   | 5     |
| `node .claude/skills/architecture-conventions/scripts/check-boundaries.mjs`      | imports hors frontière, cycles                                   | 1     |
| `node .claude/skills/architecture-conventions/scripts/size-report.mjs 300 25`    | fichiers au-dessus de 300 lignes                                 | 9     |
| `node .claude/skills/api-route-conventions/scripts/audit-routes.mjs`             | handlers hors conventions                                        | 3     |
| `node .claude/skills/testing-strategy/scripts/audit-tests.mjs`                   | `.only`, `.skip`, mock de Prisma, attentes fixes                 | 8     |

Les portes du projet (`npx tsc --noEmit`, `npm run lint`, `npm run test`,
`npm run test:integration` sur base locale, `npm run build` puis
`node scripts/check-prerender.mjs`) se rejouent soi-même et vont dans `portes` ; une porte non
rejouée va dans `nonVerifie` avec la raison.
