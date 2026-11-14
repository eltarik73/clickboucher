# Check-list de revue — toute route créée ou modifiée

À dérouler pour **chaque** `route.ts` touché, verbe par verbe. Sources : [sources.md](sources.md).

Les commandes sont en lecture seule et regroupées dans un bloc de code par section, **à copier
telles quelles** (essayées le 2026-11-14 sur ce dépôt). Elles sont volontairement hors des
tableaux : dans une cellule Markdown il faut écrire `\|`, et `rg "a\|b"` cherche alors la chaîne
littérale « a|b » — zéro résultat, donc un faux « rien à signaler ». `grep -nE` et `rg -n`
acceptent les mêmes motifs ci-dessous. Une commande qui ne renvoie rien ne prouve rien à elle
seule : elle sert à trouver les lignes à lire.

```bash
F='src/app/api/boucher/catalogue/[productId]/route.ts'   # le fichier revu, entre apostrophes
```

## A. Audience et frontière

| # | Point | Réf. |
|---|---|---|
| A1 | Audience écrite en commentaire de tête : publique / client / invité / boucher / admin / machine | S9 |
| A2 | Le chemin est sous `config.matcher` **si** le fichier (ou ses imports) atteint `server-auth`, `boucher-auth`, `admin-auth` ; sinon il n'en importe aucun | `clerk-auth` |
| A3 | Première instruction du `try` : le helper de l'audience, et `if (x.error) return x.error;` (ou la fabrique `boucherRoute` / `adminRoute`… du skill `api-route-conventions` quand elle existera : elle appelle ces mêmes helpers) | ASVS 8.2.1, 8.3.1 |
| A4 | Aucun import de valeur `auth` / `currentUser` de `@clerk/nextjs/server` | `CLAUDE.md` |
| A5 | Une route admin vit sous `/api/admin/**` ou `/api/webmaster/**`, jamais en branche `if (admin)` d'une route boucher | API5, API9 |

```bash
npm run test -- middleware-matcher                                                    # A2
grep -nE "getAuthenticatedBoucher|requireAdmin|getServerUserId|verifyCronAuth" "$F"   # A3 : attendu, en tête de chaque verbe
grep -nE "import \{[^}]*[ {,](auth|currentUser)[ ,}]" "$F"                            # A4 : attendu vide
```

## B. Objets et tenant (BOLA)

| # | Point | Réf. |
|---|---|---|
| B1 | Aucun `shopId`, `userId`, `ownerId`, `role` lu dans le corps, la query ou un en-tête pour **décider** d'un accès (un filtre d'affichage dans une route admin est acceptable) ; lire aussi les schémas Zod | S3, API1 |
| B2 | Chaque requête Prisma qui reçoit un id du client porte `shopId` (boucher), le propriétaire (client) ou passe par la relation (`product: { shopId }`) **dans son `where`** | ASVS 8.2.2, 8.4.1 |
| B3 | Écriture scoppée : `updateMany` / `deleteMany` avec le tenant, puis `count === 0` ⇒ 404 | ASVS 15.4.2 |
| B4 | Liste d'ids reçue : rechargée avec le tenant, longueurs comparées | S3 |
| B5 | Objet d'autrui ⇒ **404** ; rôle insuffisant ⇒ 403 ; pas de session ⇒ 401 | S3 |
| B6 | Agrégats (`count`, `groupBy`, `$queryRaw`) filtrés par tenant eux aussi | API1 |

```bash
grep -nE "searchParams\.get\(\"(shopId|userId|ownerId|role)\"\)" "$F"       # B1 : chaque résultat est justifié
grep -nE "findUnique\(|\.update\(|\.delete\(|\.upsert\(" "$F"               # B2, B3 : lire le where de chacun
grep -nE "count\(|groupBy\(|queryRaw|executeRaw" "$F"                       # B6
```

## C. Entrées (validation, mass assignment)

| # | Point | Réf. |
|---|---|---|
| C1 | Zod sur body, query **et** params ; `.strict()` sur une mise à jour | ASVS 2.2.1, 15.3.3 |
| C2 | Bornes : `max()` sur chaque chaîne, `int().min().max()` sur les nombres, `perPage ≤ 50` ; tout tableau reçu d'un client passe par `boundedArray(item, max)` — avec Zod 3, `z.array(item).max(n)` valide quand même chaque élément (GHSA-mrhx-c7xc-m3w5) | S22, API4 |
| C3 | Aucun champ privilégié dans le schéma accessible à l'appelant (`shopId`, `userId`, `ownerId`, `role`, `status`, prix et totaux de commande, commission, `visible`, compteurs, champs Stripe) | S5, API3 |
| C4 | Jamais `data: body`, `data: { ...body }`, `Object.assign(entity, body)` | S5 |
| C5 | URL reçue : `https`, hôte en liste blanche (jamais `z.string().url()` seul) | ASVS 1.2.2, 1.3.6 |
| C6 | Prix, totaux, statuts recalculés côté serveur ; transition selon `order-state-machine.ts` (écrite par `services/orders/transition.ts` dans le chantier prix) | ASVS 2.3.1 |

```bash
grep -nE "z\.array\(" "$F"                                    # C2 : schéma d'entrée ⇒ boundedArray
grep -nE "data: (body|json|payload)([^A-Za-z]|$)" "$F"        # C4 : attendu vide
grep -nE "data: \{ \.\.\.(body|json|payload)|Object\.assign\(" "$F"   # C4 : attendu vide ou justifié
grep -nE "\.url\(\)" "$F"                                     # C5
```

## D. Sorties

| # | Point | Réf. |
|---|---|---|
| D1 | `select` explicite ; pas de `include: { x: true }` renvoyé au client ; pour boutique et produit, les listes blanches de `src/lib/public-projections.ts` (chantier prix) | ASVS 15.3.1, API3 |
| D2 | Jamais `proPriceCents` hors `CLIENT_PRO` / propriétaire / admin ; jamais `guestToken`, `clerkId`, `ownerId` | API3 |
| D3 | Réponse dépendant de la session : `export const dynamic = "force-dynamic"`, jamais `apiCached`, clé Redis portant l'audience | ASVS 14.2.2 |
| D4 | Contenu non JSON : `Content-Type` fixé par nous, jamais relayé, jamais HTML | ASVS 3.2.1, 4.1.1 |
| D5 | Chaîne saisie par un tiers rendue hors React (e-mail, JSON-LD, ticket) : échappée | ASVS 1.2.1, 1.2.3 |

```bash
grep -nE "include: \{|: true \}" "$F"                          # D1
grep -nE "proPriceCents|guestToken|clerkId|ownerId" "$F"       # D2 : chaque résultat est une lecture serveur, pas une sortie
grep -nE "apiCached|redis\.(get|set)|force-dynamic" "$F"       # D3
```

## E. Abus, erreurs, journaux

| # | Point | Réf. |
|---|---|---|
| E1 | `GET` sans effet de bord (cookies `SameSite=Lax` : une navigation ne doit jamais muter) | `clerk-auth` C17 |
| E2 | Rate limit si mutation anonyme, envoi, appel payant, essai de code — placé **avant** la validation du corps | ASVS 2.4.1, API4, API6 |
| E3 | `catch` → `handleApiError(error, "contexte")` ; message générique | ASVS 16.5.1 |
| E4 | `logger`, pas `console` ; ni secret, ni jeton, ni corps entier, ni e-mail en clair | ASVS 16.2.5 |
| E5 | Admin : `writeAuditLog` sur chaque mutation | `clerk-auth` § 3 |

```bash
grep -nE "checkRateLimit|\.parse\(|safeParse\(" "$F"     # E2 : ordre des lignes
grep -nE "console\.|logger\." "$F"                       # E4
grep -n  "writeAuditLog" "$F"                            # E5
```

## F. Requêtes sortantes et fichiers

| # | Point | Réf. |
|---|---|---|
| F1 | `fetch` vers une URL influencée par le client : liste blanche d'hôtes sur `new URL().hostname`, `redirect: "error"`, `AbortSignal.timeout`, taille plafonnée, type en liste blanche | S6, ASVS 1.3.6 |
| F2 | Fichier : rôle + propriété, taille, type déclaré + octets magiques **avant** tout appel à `sharp`, ré-encodage (refus si échec), nom généré, jamais de SVG | S7, ASVS 5.2.x |

## G. Tests (dans le même PR)

- [ ] anonyme → 401 ; mauvais rôle → 403 ; **mauvais tenant → 404 et aucune écriture** ;
      entrée invalide (clé en trop incluse) → 400 ; cas nominal.
- [ ] Le test importe le **vrai** handler (modèle : `autorisation-par-construction.md` § 5) ;
      jamais une copie de la logique (contre-exemple : `tests/security/multitenant.test.ts`).
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` verts.
