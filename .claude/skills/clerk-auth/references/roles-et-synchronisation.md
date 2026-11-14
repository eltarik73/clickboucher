# Rôles, caches, webhook et synchronisation des utilisateurs

État du code : branche de travail, relu le 2026-11-14 (auteur, puis vérificateur indépendant :
chaque ligne citée a été rouverte). Sources : [sources.md](sources.md).

## 1. Modèle

- `User.role` (enum Prisma `Role`) : `CLIENT`, `CLIENT_PRO`, `CLIENT_PRO_PENDING`, `BOUCHER`, `ADMIN`.
- `User.clerkId` : `String? @unique`. `null` pour un invité (`isGuest: true`, `guestToken` unique).
- `Shop.ownerId` : chaîne **sans clé étrangère**, qui contient soit l'id Prisma, soit l'id Clerk
  (héritage) → toute recherche de propriétaire utilise
  `where: { OR: [{ ownerId: clerkId }, { ownerId: dbUser.id }] }`.
- Miroir Clerk : `publicMetadata.role` en minuscules (`client`, `client_pro`,
  `client_pro_pending`, `boucher`, `admin`). `publicMetadata` est lisible mais non modifiable depuis
  le navigateur [C15] ; il ne sert chez nous qu'au middleware, à `requireAdmin`, à `/admin-login` et
  à l'affichage.

Règle de `CLAUDE.md` : **la base fait foi**. Les metadata sont un miroir que nos routes
maintiennent ; la doc Clerk elle-même recommande de garder les données supplémentaires dans sa
propre base plutôt que de rappeler `getUser()` (risque de limite de débit, plus lent qu'une requête
SQL) [C14].

## 2. Qui lit quoi

| Lecteur | Fichier:ligne | Source | Remarque |
|---|---|---|---|
| Middleware | `src/middleware.ts:55-97` | `clerkClient().users.getUser()` → `publicMetadata.role` | appel réseau à l'API Clerk sur défaut de cache ; cache Redis `role:<clerkId>` 60 s, `""` = « pas de rôle » |
| `getAuthenticatedBoucher()` | `src/lib/boucher-auth.ts:44-98` | base (`User.role`, puis `Shop` par `OR`) | accepte `BOUCHER` et `ADMIN`, mais ne renvoie que la boutique dont l'appelant est **propriétaire** (404 pour un admin sans boutique) : une route `/api/boucher/**` n'est pas une route admin |
| `requireAdmin()` | `src/lib/admin-auth.ts:28-64` | `currentUser().publicMetadata.role` **puis** base | écart avec `CLAUDE.md` (point à arbitrer n° 2) |
| `resolveUserRole()` | `src/lib/auth/server-auth.ts:82-98` | base | en mode test : `"admin"` pour ADMIN, `undefined` sinon |
| `/admin-login` | `src/app/(auth)/admin-login/page.tsx:14-33` | `currentUser().publicMetadata.role` | page dans le matcher |
| Composants client | `espace-boucher/page.tsx:98`, `inscription-pro/page.tsx:49`, `hooks/useCurrentUser.ts:35` | `user.publicMetadata.role` | affichage uniquement |

Code mort à ne pas réutiliser : `getRoleFromClaims()` (`src/lib/roles.ts:23`, suppose un claim
`metadata` que nous n'avons plus), `roleFromClerk()` (`src/lib/auth/rbac.ts`, suppose les
Organizations Clerk), `src/components/providers/LazyClerkProvider.tsx` (aucun importateur).

## 3. Les trois caches

| Cache | Clé | TTL | Purgé par `invalidateRoleCache()` ? |
|---|---|---|---|
| Middleware | Redis `role:<clerkId>` (ou `Map` si Redis absent) | 60 s | Redis oui, `Map` non |
| Boucher | `Map` par instance puis Redis `boucher:auth:<clerkId>` | 60 s + 60 s | Redis oui, `Map` non |
| Admin | `Map` par instance (`adminCache`) | 60 s | non |

Donc : après un changement de rôle correctement invalidé, une instance chaude peut encore répondre
selon l'ancien rôle pendant **au plus 60 s**. C'est le compromis assumé (commentaire
`role-cache.ts:30-32`, dont le « 5 min » est périmé : tout est à 60 s). Ne pas rallonger ces TTL.
OWASP ASVS 8.3.2 (niveau 3) demande que les changements d'autorisation s'appliquent immédiatement ou
soient compensés [C25] : ne pas promettre mieux que 60 s dans une interface.

## 4. Écrire un rôle — chemin canonique

Trois écritures, dans cet ordre, dans la même requête :

1. `prisma.user.update({ data: { role } })` — la vérité.
2. `clerk.users.updateUserMetadata(clerkId, { publicMetadata: { role: "<minuscule>" } })` — le
   miroir (limité à 10 mises à jour / 10 s par utilisateur [C12]).
3. `await invalidateRoleCache(clerkId)` — sinon l'ancien rôle vit jusqu'à 60 s dans Redis.

Plus une entrée `writeAuditLog` (acteur, cible, ancien et nouveau rôle). Modèle existant des trois
écritures : `src/app/api/admin/users/[id]/route.ts:52-72` — il n'écrit **pas** d'entrée d'audit ;
les deux routes `webmaster/staff` en écrivent une mais n'invalident pas le cache : aucune route
n'a les quatre gestes. Fonction prête à extraire dans `src/lib/auth/` : `setUserRole` dans
[patterns.md](patterns.md) § 7 (elle revient à l'ancien rôle si la mise à jour Clerk échoue).

Pourquoi le miroir n'est pas facultatif : le webhook `user.updated` **recopie
`publicMetadata.role` dans `User.role`** à chaque événement dès que les metadata portent un rôle
connu (`webhooks/clerk/route.ts:131-135`). Un rôle changé en base seulement (script, Prisma
Studio, route incomplète) est donc écrasé dès que l'utilisateur modifie son profil — défaut W7
ci-dessous.

Routes qui changent un rôle **sans** l'étape 3 aujourd'hui (défaut à corriger quand on y passe) :

| Route | Ligne | Changement |
|---|---|---|
| `src/app/api/webmaster/staff/route.ts` | 150-156 | → `ADMIN` |
| `src/app/api/webmaster/staff/[userId]/route.ts` | 48-54 | `ADMIN` → `CLIENT` (rétrogradation : la plus sensible) |
| `src/app/api/shops/register/route.ts` | 111-117 | → `BOUCHER` |
| `src/app/api/users/upgrade-pro/route.ts` | 59-68 | → `CLIENT_PRO_PENDING` |
| `src/app/api/onboarding/route.ts` | 73-80, 94 | création `CLIENT` / `BOUCHER` |

Le webhook `user.updated` finit par invalider Redis **si** il est bien configuré côté Clerk ; ne pas
compter dessus (§ 5).

Ne jamais écrire `webmaster` dans les metadata : accepté par `isAdmin()` et le middleware
(`ADMIN_ROLES`), mais absent du `ROLE_MAP` du webhook (`webhooks/clerk/route.ts:14-20`) → la base
resterait `CLIENT` et les routes fondées sur la base refuseraient l'accès.

## 5. Le webhook Clerk

### Ce que dit Clerk [C9][C10]

- Les webhooks sont **asynchrones** ; la livraison n'est « pas garantie », les événements peuvent
  arriver « dans le désordre ou plus d'une fois » ; la synchronisation est « eventually consistent ».
- Ils ne conviennent pas « aux flux synchrones où l'on doit savoir que le webhook a été livré avant
  de passer à l'étape suivante ».
- Toute réponse non 2xx (ou absente) déclenche une nouvelle tentative selon le calendrier Svix ;
  chaque tentative d'un même événement porte le même en-tête `svix-id`.
- Traiter la charge comme non sûre tant que la signature n'est pas vérifiée ; rendre le traitement
  idempotent (upsert) et comparer `updated_at` pour écarter un événement périmé.
- Événements utilisateur : `user.created`, `user.updated`, `user.deleted` (et `user.merged`).

### Ce que fait notre route (`src/app/api/webhooks/clerk/route.ts`)

Vérification Svix sur le corps brut (`:47-63`, 401 si invalide) — correct. La route est exclue du
matcher, et doit le rester (aucune session dans un webhook).

Défauts présents, par gravité :

| # | Ligne | Défaut | Conséquence | Correctif |
|---|---|---|---|---|
| W1 | 69-80 | La clé d'idempotence `webhook:clerk:<svix-id>` est posée (`SET NX`, 24 h) **avant** le traitement | Si le traitement échoue (base indisponible, contrainte), la réponse est une erreur, Svix réessaie, mais la nouvelle tentative est vue comme « doublon » et acquittée : l'événement est perdu | Poser le marqueur **après** succès, ou le supprimer dans le `catch` ; OWASP : ne renvoyer 200 qu'une fois l'événement traité ou mis en file de façon durable [C26] |
| W2 | 99-108 | `user.created` fait `create`, pas `upsert` | collision avec les autres créateurs de la ligne `User` (`/api/onboarding`, `getOrCreateUser()`, comptes invités) : l'événement échoue sur une contrainte unique (cas détaillés : registre privé du programme) | Upsert par `clerkId` + fusion de l'invité si l'e-mail principal est **vérifié** |
| W3 | 137-140 | `user.updated` fait `update` sur une ligne qui peut ne pas exister | exception → 4xx/5xx → tombe dans W1 | même upsert |
| W4 | 87, 117 | E-mail = `email_addresses[0]` | pas forcément l'adresse principale | utiliser `primary_email_address_id` |
| W5 | — | Aucun contrôle d'ordre | un `user.updated` ancien peut écraser un plus récent | comparer `updated_at` (demande une colonne dédiée) |
| W6 | 26, 77 | `console.error` / `console.warn` | hors logger structuré | `logger` |
| W7 | 131-135 | `user.updated` écrit en base le rôle lu dans les metadata | la base ne « fait foi » que tant que le miroir est à jour : une rétrogradation faite en base seulement est annulée au prochain événement | soit toute écriture de rôle passe par `setUserRole`, soit le webhook cesse d'écrire `role` — point à arbitrer n° 2 du skill |

Version cible, compilée contre nos versions : `POST` de [patterns.md](patterns.md) § 6. Elle
utilise `verifyWebhook` de `@clerk/nextjs/webhooks` (présent en 6.39.9 ; la faille de vérification
GHSA-9mp4-77wg-rwx9 de ce helper est corrigée depuis `@clerk/backend` 2.4.0 [C7]).

### Course webhook ↔ onboarding

`/onboarding` (page client) appelle `/api/auth/me` : si une ligne `User` existe, l'utilisateur est
considéré comme déjà inscrit et redirigé selon son rôle ; sinon il choisit client ou boucher et
`POST /api/onboarding` crée la ligne (`409 CONFLICT` si elle existe déjà,
`api/onboarding/route.ts:41-46`). Si le webhook `user.created` gagne la course, la ligne existe déjà en
`CLIENT` et le choix « boucher » n'est jamais proposé. Si l'onboarding gagne, le webhook échoue sur
la contrainte unique (W2) puis est avalé (W1). Comportement réel **non vérifié en production** : il
dépend de la présence et de la vitesse du webhook configuré dans le dashboard Clerk. Règle pour tout
nouveau code : ne jamais déduire « déjà inscrit » de la seule existence de la ligne ; porter un
indicateur explicite (par exemple une date de fin d'onboarding) — à arbitrer avec le propriétaire
avant d'ajouter une colonne.

## 6. Invités

- Création : `POST /api/checkout/guest` (`src/app/api/checkout/guest/route.ts`) crée un `User`
  fantôme (`isGuest: true`, `guestToken: randomUUID()`), refuse si un compte Clerk a déjà cet
  e-mail et pose le cookie httpOnly `klikgo-guest-token`.
- Lecture : `getGuestUser()` (`guest-auth.ts`) exige `clerkId: null` mais n'a aucun appelant au
  2026-11-14 ; la page `/suivi/[id]` accepte le jeton par cookie **ou** par `?guestToken=`.
- Portée, durée et transport du jeton invité : état actuel dans le registre privé du programme.
  Pour tout nouveau code invité : jeton aléatoire, comparé dans le `where`, de portée et de durée
  minimales.
- Les questions de sécurité associées (jeton dans l'URL, limitation de débit) sont traitées
  dans le skill `security-multitenant`.

## 7. `getOrCreateUser()` — le filet

`src/lib/get-or-create-user.ts` : cherche par `clerkId`, sinon lit l'utilisateur dans l'API Clerk et
crée la ligne en `CLIENT`. À utiliser dans toute route où un utilisateur fraîchement inscrit peut
arriver avant le webhook (commande, profil). Limites : un appel réseau Clerk ; renvoie `null` si la
création échoue (dont le cas W2) — tester le `null`.

## 8. Suppression et bannissement

- `user.deleted` : anonymisation de la ligne (e-mail `deleted_<id>@deactivated.klikgo`, nom
  « Compte Supprimé », téléphone nul) et purge des caches ; les commandes sont conservées
  (`webhooks/clerk/route.ts:152-178`). Le rôle n'est pas remis à `CLIENT` : sans session Clerk il
  est inatteignable, mais ne pas réutiliser cette ligne.
- `clerk.users.banUser(userId)` (présent dans `@clerk/backend` 2.33.9 [L1]) révoque toutes les
  sessions de l'utilisateur et lui interdit de se reconnecter [C27]. Le jeton de 60 s déjà émis
  peut encore servir jusqu'à son expiration (déduction du modèle [C11]) et **nos caches de rôle ne
  regardent pas `banned`**. Pour couper un boucher tout de suite : rétrograder le rôle en base
  (chemin du § 4) en plus du bannissement.
- Exigence ASVS 7.4.2 : terminer les sessions actives quand un compte est désactivé [C25] — côté
  Clerk, c'est le bannissement ou `sessions.revokeSession` ; à faire depuis le dashboard ou une
  route admin, jamais en modifiant seulement la base.
