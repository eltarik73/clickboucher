---
name: react-patterns
description: >-
  Règles de pureté React pour les composants et hooks de Klik&Go sous Next.js App Router : rendu
  idempotent sans date, aléatoire ni effet de bord, props et état jamais mutés, valeur dérivée
  calculée au rendu au lieu d'être synchronisée par un effet, remise à zéro par key, action placée
  dans le gestionnaire d'événement, abonnement externe par useSyncExternalStore, fetch dans un effet
  avec annulation et garde d'authentification, rafraîchissement par useVisiblePolling, gestionnaires
  async qui traitent leurs erreurs, dépendances d'effet jamais réduites au silence. À charger avant
  d'écrire ou relire un composant client, un hook, un useEffect, un useState, un formulaire ou une
  page avec use client. Pas pour choisir serveur ou client ni le mode de rendu (nextjs-app-router),
  le style (design-klikgo) ni le découpage d'une page géante (architecture-conventions).
when_to_use: >-
  React, composant, hook, useEffect, useState, useMemo, useCallback, useReducer, useRef,
  useSyncExternalStore, key, key={index}, re-render, effets en cascade, état dérivé, setInterval,
  polling, fetch au montage, isLoaded, isSignedIn, useAuth, hydratation, Date.now dans un composant,
  onClick async, no-misused-promises, exhaustive-deps, eslint-disable, formulaire, page client.
---

# Pureté React — Klik&Go

Un composant client de Klik&Go doit rendre la même chose pour les mêmes entrées, garder un état
minimal et ne réserver `useEffect` qu'à la synchronisation avec l'extérieur. Ce skill remplace
l'ancien aide-mémoire générique (son polling par `setInterval` nu contredisait `CLAUDE.md`) et garde
le rôle que lui donne `design-klikgo` § 8 : la mécanique React.

**Précédence** : `CLAUDE.md` (§ « Coût CPU Vercel », « Next.js App Router », « Performance
(PageSpeed) ») > `seo-anti-penalty` > skills vérifiés du programme > ce skill. Un désaccord va dans
« Points à arbitrer » et au directeur pour `klikgo-programme/references/contradictions-connues.md` ;
il ne se tranche jamais dans le code.

Voisins, à ne pas recopier : `nextjs-app-router` (serveur ou client, rendu, hydratation),
`vercel-cost-performance` (coût), `clerk-auth`, `architecture-conventions` (découpage),
`typescript-patterns` (types, promesses), `click-and-collect` (idempotence), `ux-marketplace`
(états d'écran), `test-discipline` § 8 (tests de composants), `quality-gates` (règles ESLint).

## 1. Le rendu est pur

Mêmes props, état et contexte ⇒ même JSX. Pendant le rendu : aucun `fetch`, aucune écriture (DOM,
`document.title`, variable de module, stockage), aucun `ref.current` lu ou écrit hors initialisation
paresseuse (`if (ref.current === null) ref.current = …`). **Pourquoi** : l'App Router rend le
composant sur le serveur puis l'hydrate ; en développement le Strict Mode, actif par défaut sous
l'App Router, le rend deux fois ; React peut jeter un rendu.

- **Horloge et hasard** (`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`) ne
  décident jamais du JSX du premier rendu d'un composant rendu côté serveur (`CLAUDE.md`). Heure
  affichée : après montage, `useMountedNow()` (`src/components/product/ProductCard.tsx`) ou un état
  `now` posé par une minuterie (§ 5). Identifiant DOM : `useId()` (`src/components/ui/form-field.tsx`).
  Clé d'idempotence : créée dans le gestionnaire (`handleOrder`, `src/app/(client)/panier/page.tsx`).
- **Navigateur** (`localStorage`, `sessionStorage`, `window`, `matchMedia`, `document.cookie`) : jamais
  pour le JSX du premier rendu. Valeur lue une fois : `useStoredFlag` (`src/hooks/use-stored-flag.ts`).
  Valeur qui change : `useSyncExternalStore` (§ 3). `hasTestModeCookie()` lu au rendu est admis tant
  qu'il ne sert qu'à la condition d'un effet (modèle `src/app/(client)/decouvrir/NearbyShops.tsx`).
- `useEffectEvent` et le React Compiler n'existent pas dans le React installé : ne pas les importer.

## 2. Rien de ce qu'on n'a pas créé n'est muté

Props, état, valeurs de contexte, arguments et retours de hook, objets déjà passés au JSX : copie
puis remplacement (`{ ...line, quantity }`, `map`, `filter`, `[...list, item]`). **Pourquoi** : React
compare par référence ; un état muté ne déclenche pas de rendu ou perd une mise à jour. Un tableau
créé dans ce rendu peut être muté localement. Mises à jour liées entre elles ⇒ reducer pur, exporté
et testé sans DOM : modèle `cartReducer` (`src/lib/cart/cart-line.ts`, testé par
`src/lib/__tests__/cart-line.test.ts`), `switch` exhaustif, aucune horloge ni E/S.

## 3. Avant d'écrire un `useEffect`

Un effet sert à se synchroniser avec un système extérieur (réseau, minuterie, API du navigateur, DOM
impératif) et se nettoie. Tout le reste a une meilleure place. Paires incorrect / correct écrites
pour ce dépôt : [references/effets.md](references/effets.md).

| Besoin                                                          | Faire                                                                             | Pas                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| Valeur dérivée (total, liste filtrée, compteur, libellé)        | la calculer au rendu ; `useMemo` seulement si une mesure dépasse ≈ 1 ms           | `useState` + effet qui recopie      |
| Remettre l'état à zéro quand un identifiant change              | `key={order.id}` sur le composant                                                 | effet qui remet chaque champ        |
| Garder « l'élément choisi »                                     | stocker son `id`, retrouver l'objet au rendu                                      | stocker l'objet, le resynchroniser  |
| Action de l'utilisateur (POST, toast, navigation)               | dans le gestionnaire d'événement                                                  | drapeau `submitted` lu par un effet |
| Prévenir le parent                                              | appeler `onChange` dans le même gestionnaire, ou remonter l'état                  | effet qui observe l'état local      |
| Plusieurs états à changer ensemble                              | un seul gestionnaire, ou un reducer                                               | effet A ⇒ `set` ⇒ effet B           |
| Abonnement (en ligne, `matchMedia`, stockage d'un autre onglet) | `useSyncExternalStore`, `subscribe` hors du composant, `getServerSnapshot` neutre | effet + `setState`                  |
| Donnée publique de la page                                      | Server Component si le mode de rendu le permet (`nextjs-app-router` § 5)          | fetch client au montage             |

**Exception propre à Klik&Go** : une valeur d'horloge ou de stockage sur un composant rendu côté
serveur ne se « calcule pas au rendu » ; l'effet après montage (`useMountedNow`, `useStoredFlag`,
`timeLeft` de `BonsPlansClient.tsx`) est le bon outil et ne se « simplifie » pas.

## 4. Fetch côté client

Annulable, gardé, et chaque état affiché. **Pourquoi** : sans annulation, une réponse lente écrase la
plus récente (créneaux d'une autre date, page 3 après un filtre) ; sans garde, chaque visiteur
anonyme paie un middleware et une fonction pour une réponse vide (panne de novembre 2026, `CLAUDE.md`).

```tsx
const { isLoaded, isSignedIn } = useAuth();
const canLoad = (isLoaded && !!isSignedIn) || hasTestModeCookie(); // src/lib/test-mode-client.ts
useEffect(() => {
  if (!canLoad) return;
  let ignore = false;
  async function load() {
    let res: Response;
    try {
      res = await fetch("/api/favorites");
    } catch {
      if (!ignore) setFavorites("error"); // fetch ne rejette que sur coupure réseau
      return;
    }
    if (!ignore) setFavorites(res.ok ? readShopIds(await res.json()) : "error");
  }
  void load();
  return () => {
    ignore = true;
  };
}, [canLoad]);
```

- Défaut : drapeau `ignore`. Variante : `AbortController` quand la requête précédente doit aussi
  s'arrêter côté réseau (saisie, debounce) ; modèle `src/lib/hooks/use-order-quote.ts`.
- Le `try` n'entoure que le `fetch` : un bug de lecture de la réponse remonte (Sentry navigateur)
  au lieu de s'afficher comme « connexion impossible ».
- L'état distingue « pas encore chargé » (`null`), « vide » (`[]`) et `"error"` ; rendu des trois
  états : `ux-marketplace`. `readShopIds` est un parseur local de la réponse (`typescript-patterns` § 1).
- Donnée publique (avis, suggestions) : en props depuis le Server Component, pas d'appel au montage.
  L'accueil appelle `/api/geo` et `/api/shops/nearby` (exclues du matcher, en cache) pour tout
  visiteur : cas existant, à ne pas étendre sans arbitrage (Points à arbitrer n° 4). Autres écarts :
  [etat-du-code.md](references/etat-du-code.md) § 6.

## 5. Minuteries et polling

- **Rafraîchir depuis le réseau** : `useVisiblePolling(fn, intervalMs, enabled)`
  (`src/hooks/useVisiblePolling.ts`) — pause onglet caché, appel immédiat au retour, `fn` qui renvoie
  `false` ou lève ⇒ nouvel essai à 5 s puis backoff jusqu'à 15 min ; `enabled` à `false` sur un état
  final. Suivi d'une commande : `startVisiblePolling` + `nextOrderPollDelay`. Cuisine : boucle de
  `src/hooks/use-order-polling.ts`, qu'on ne touche qu'avec `order-lifecycle-realtime`.
- **Horloge affichée sans réseau** : `setInterval` dans un effet, démarré après montage, nettoyé
  (modèle : `clockStr` de `src/app/(boucher)/boucher/commandes/page.tsx`).
- Toute minuterie naît dans le corps de l'effet et meurt dans son nettoyage, jamais dans un rappel
  qui lui survit. `cost-audit.mjs` (`vercel-cost-performance` § 6) signale le polling nu.

## 6. Gestionnaires async

Une fonction async passée à `onClick` ou `onSubmit` traite elle-même ses échecs : bouton désactivé
pendant l'envoi, message d'erreur visible, bouton réactivé dans `finally`. **Pourquoi** : React ignore
la promesse renvoyée ; un rejet laisse l'écran bloqué sans rien dire. C'est la dette la plus
répandue des pages (comptes : [references/etat-du-code.md](references/etat-du-code.md)).

```tsx
async function save() {
  setSaving(true);
  setError(null);
  try {
    const res = await fetch(`/api/products/${productId}`, { method: "PATCH", body });
    if (!res.ok) setError("Enregistrement refusé. Vérifiez les champs.");
  } catch {
    setError("Connexion impossible. Réessayez."); // fetch ne rejette que sur coupure réseau
  } finally {
    setSaving(false);
  }
}
<Button onClick={() => void save()} disabled={saving}>
  Enregistrer
</Button>;
```

`void` marque l'appel volontaire et satisfait `no-misused-promises` et `no-floating-promises`.
Commande : `idempotencyKey` créée dans le gestionnaire et réutilisée au nouvel essai (`click-and-collect`).

## 7. Dépendances d'effet

`react-hooks/exhaustive-deps` n'est jamais réduit au silence par `eslint-disable`. Remèdes, dans
l'ordre : déplacer la fonction **dans** l'effet ; la sortir du composant si elle ne lit ni props ni
état ; déplacer la logique dans un gestionnaire (§ 3). Dépendre de primitives (`shopId`), pas d'un
objet reconstruit à chaque rendu. **Pourquoi** : une dépendance omise lit une valeur périmée ; et
`lint-staged` (`eslint --fix --max-warnings=0`) refuse tout commit d'un fichier qui garde un
avertissement, même ancien.

## 8. Clerk et taille

- `<ClerkProvider>` sans `dynamic` (`CLAUDE.md`) ⇒ `useAuth()` / `useUser()` valent `isLoaded: false`
  au premier rendu : rendu « déconnecté » par défaut, drapeaux dans les dépendances (`clerk-auth` § 2, règle 7).
- ≥ 8 `useState` ou plusieurs effets qui chargent : découper selon `architecture-conventions` § 6-7,
  hook nommé par son intention (`useAvailableSlots`).

## Pièges vus dans ce dépôt

- **« Calculer au rendu » appliqué à l'horloge** : l'ancien `EstimatedCountdown` de
  `SuiviClient.tsx` (page rendue côté serveur) démarrait par `useState(Date.now())` et formatait
  l'heure sans fuseau : HTML serveur et navigateur divergeaient. Corrigé par le chantier
  C1-INVITES ; modèle désormais : `src/app/(client)/suivi/[id]/EstimatedCountdown.tsx` (`now` à
  `null` jusqu'au montage, heure par `formatParisTime`).
- **Effet de remise à zéro** : `useEffect(() => { setPage(1); }, [filtres])` dans
  `src/app/webmaster/commandes/page.tsx` et `catalogue/page.tsx` ⇒ deux requêtes, sans annulation,
  la vieille peut gagner. `setPage(1)` va dans le `onChange` du filtre.
- **État recopié d'une prop** : `visible` de `src/components/boucher/OrderAlertOverlay.tsx` recopie
  `order` par un effet ; `if (!order) return null` suffit (le parent remet `order` à `null`).
- **Parent prévenu par un effet, `eslint-disable` mal placé** :
  `src/components/location/LocationPicker.tsx` (le commentaire vise `useEffect`, l'avertissement
  porte sur le tableau de dépendances et sort quand même).
- **`async function load()` dans le composant + `useEffect(() => { load(); }, [id])`** : avertissement,
  promesse flottante, pas d'annulation (`support/[ticketId]` boucher et admin, `admin/shops/[shopId]`) ;
  tout commit qui touche ces fichiers est bloqué tant que ce n'est pas corrigé.
- **`key={idx}` sur une liste éditable** : options de découpe de `ProductForm.tsx` /
  `ProductFormPage.tsx` (suppression d'une ligne) ⇒ l'état interne glisse d'une ligne. Identifiant
  stable créé à l'ajout. Une liste statique de squelettes en `key={i}` est correcte.
- **Minuterie hors nettoyage** : `AnimatedStat` (`src/app/(client)/espace-boucher/page.tsx`) lance un
  `setInterval` dans un rappel d'`IntersectionObserver` ; le nettoyage ne l'arrête pas.
- **Hasard au rendu** : `ConfettiBurst` (`commande/[id]/page.tsx`) tire de nouvelles positions à
  chaque rendu ⇒ dériver de l'index ; `src/components/boucher/QRScanner.tsx` ⇒ `useId()`.
- **Ref écrite pendant le rendu** (`fnRef.current = fn`) : présent dans `useVisiblePolling`,
  `use-cart.tsx` et la cuisine. Toléré dans l'existant, pas recopié (Points à arbitrer).
- **Faux défauts** : `OfferPopup` en `<img>` natif est voulu (`CLAUDE.md`) ; un composant Server ou
  Client mal placé relève de `nextjs-app-router`.

## Procédure (écrire ou relire un composant client)

1. Lister l'état : pour chaque `useState`, se demander s'il se calcule à partir d'un autre (§ 3).
2. Pour chaque `useEffect`, nommer le système extérieur synchronisé ; sans réponse, appliquer § 3.
3. Vérifier le premier rendu : rien d'horloge, de hasard ni de navigateur dans le JSX (§ 1).
4. Fetch : garde d'auth, annulation, trois états (§ 4). Rafraîchissement : `useVisiblePolling` (§ 5).
5. Gestionnaires async : désactivation, erreur visible, `void` (§ 6).
6. Lancer `npm run lint` puis `npx tsc --noEmit` ; corriger, relancer jusqu'à zéro avertissement sur
   les fichiers touchés. Les règles de promesses ne sont pas encore dans `.eslintrc.json` : lancer
   la commande typée de `etat-du-code.md` § 1 sur ces fichiers (aucun message sur les lignes
   écrites ou modifiées).
7. Logique d'état non triviale : reducer pur + test unitaire ; composant : `test-discipline` § 8.
8. Sur le serveur qui tient la tâche (recette locale, `klikgo-programme` § 5 et § 10), onglet
   Réseau, navigation privée : aucun appel API au montage sans session, aucun appel en double qui
   persiste (en dev, le double montage du Strict Mode est normal s'il est annulé), aucun
   avertissement d'hydratation dans la console. Sinon : `nonVerifie`.

Gravité en relecture (`klikgo-review` § 2) : polling nu, appel anonyme ou horloge au premier rendu,
avec scénario = **bloquant** ; course sans annulation, `eslint-disable` de dépendances, échec
silencieux = **majeur** ; `useMemo` non mesuré, état redondant sans effet visible = **mineur**.

## Points à arbitrer (propriétaire)

1. **`no-misused-promises` et `no-floating-promises` en erreur dans les pages** (`quality-gates`) :
   garder ou non la vérification des attributs JSX (`checksVoidReturn.attributes`), qui porte la
   quasi-totalité des cas ; ordre de resserrement.
2. **Version récente d'`eslint-plugin-react-hooks`** (`purity`, `refs`, `set-state-in-effect`,
   `immutability`) : dépendance nouvelle, compatibilité avec `next lint` non vérifiée.
3. **Refs écrites pendant le rendu** dans les hooks existants : les laisser, ou les déplacer dans un
   `useLayoutEffect` (touche `useVisiblePolling`, `use-cart.tsx`, la cuisine).
4. **Appel public au montage pour un anonyme** : `CLAUDE.md` n'en prévoit aucun ; l'accueil le fait
   vers deux routes exclues du matcher (`vercel-cost-performance`). Écrire l'exception dans
   `CLAUDE.md`, ou passer ces données en props. Signalé pour `contradictions-connues.md`.

## Définition de terminé

- [ ] Aucun `useState` qui recopie une valeur calculable ; chaque effet nomme ce qu'il synchronise.
- [ ] Aucune horloge, aucun hasard, aucune lecture du navigateur dans le JSX du premier rendu.
- [ ] Tout fetch au montage : garde `(isLoaded && isSignedIn) || hasTestModeCookie()`, annulation,
      états chargement / vide / erreur.
- [ ] Aucun `setInterval` réseau : `useVisiblePolling` ; toute minuterie nettoyée.
- [ ] Gestionnaires async : désactivation, erreur visible, aucun rejet silencieux.
- [ ] Aucun `eslint-disable` de `react-hooks/*` ajouté ; `npm run lint` sans avertissement sur les
      fichiers touchés ; règles de promesses muettes sur les lignes modifiées ; `npx tsc --noEmit` vert.
- [ ] Reducer ou helper pur ajouté : test unitaire (`npm run test`).
- [ ] Vérification de l'étape 8 faite et décrite ; ce qui n'a pas été vérifié est listé (`nonVerifie`).

## Fichiers de référence

- [references/effets.md](references/effets.md) — à lire avant de remplacer un effet ou d'écrire un
  fetch, un abonnement ou un gestionnaire async : paires incorrect / correct (panier, cuisine,
  favoris, créneaux, filtres).
- [references/etat-du-code.md](references/etat-du-code.md) — à lire avant un audit ou pour citer un
  chiffre : comptes datés, fichiers candidats, commandes de remesure.
- [references/sources.md](references/sources.md) — à lire pour vérifier une règle ou sa licence.
- `scripts/etat-react.cjs` — lancer depuis la racine du dépôt (lecture seule, sans réseau) pour
  remesurer l'inventaire des hooks (mode d'emploi dans `etat-du-code.md`).
