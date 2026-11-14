# Effets : paires incorrect / correct pour Klik&Go

Exemples écrits pour ce dépôt (centimes, `shopId`, helpers existants). Les formes « incorrect »
reprennent des motifs relevés dans `src/` (fichier cité) ; les formes « correct » sont à recopier.
Chaque exemple suppose `"use client"` en tête de fichier. Un nom sans chemin (`OrderNoteEditor`,
`CutOptionRow`, `readShopIds`, `pickActiveOrder`…) est un exemple, pas un fichier du dépôt. Règles
et pourquoi : `SKILL.md`.

## Sommaire

1. Valeur dérivée au lieu d'un état synchronisé
2. Remise à zéro par `key`
3. Garder l'identifiant, pas l'objet
4. Filtre et pagination dans le même gestionnaire
5. Prévenir le parent sans effet
6. Fetch gardé et annulable (favoris)
7. Créneaux de retrait : course entre deux dates
8. Rafraîchissement périodique
9. Horloge après montage
10. Abonnement externe : `useSyncExternalStore`
11. Gestionnaire async d'une action boucher
12. Dépendances d'effet sans `eslint-disable`
13. Liste éditable : clé stable
14. Hasard et identifiants au rendu
15. Reducer pur

## 1. Valeur dérivée au lieu d'un état synchronisé

Incorrect (motif de `src/components/boucher/OrderAlertOverlay.tsx`, et d'une liste filtrée recopiée) :

```tsx
const [visible, setVisible] = useState(false);
useEffect(() => {
  setVisible(!!order);
}, [order]); // un rendu de retard

const [readyOrders, setReadyOrders] = useState<KitchenOrder[]>([]);
useEffect(() => {
  setReadyOrders(orders.filter((o) => o.status === "READY")); // copie à resynchroniser
}, [orders]);
```

Correct :

```tsx
if (!order) return null; // le parent remet order à null

const readyOrders = orders.filter((o) => o.status === "READY"); // calcul au rendu
const readyTotalCents = readyOrders.reduce((sum, o) => sum + o.totalCents, 0);
```

Modèle dans le dépôt : les vues `pendingOrders`, `inProgressOrders`, `readyOrders` de
`src/hooks/use-order-polling.ts`, calculées au rendu. `useMemo` seulement si une mesure
(`console.time` autour du calcul, build de production) dépasse ≈ 1 ms par interaction ; un filtre
sur les commandes d'une boutique n'en a pas besoin.

## 2. Remise à zéro par `key`

Incorrect : un brouillon de note qui survit au changement de commande.

```tsx
function OrderNoteEditor({ order }: { order: KitchenOrder }) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setDraft("");
  }, [order.id]); // un rendu avec la note de l'autre commande
  // …
}
```

Correct : le parent donne une `key`, React recrée l'état.

```tsx
<OrderNoteEditor key={order.id} order={order} />
```

## 3. Garder l'identifiant, pas l'objet

Une fenêtre ouverte sur une commande du mode cuisine reçoit une copie figée si l'on stocke l'objet
(`stockIssueOrder`, `adjustPriceOrder` de `boucher/commandes/page.tsx`) : le polling met à jour la
liste, pas la copie. Quand l'écran doit suivre la commande, stocker l'`id` :

```tsx
const [stockIssueOrderId, setStockIssueOrderId] = useState<string | null>(null);
const stockIssueOrder = orders.find((o) => o.id === stockIssueOrderId) ?? null; // disparaît si la commande sort
```

Si la copie figée est voulue (le boucher saisit un prix sur la commande telle qu'il l'a ouverte),
l'écrire en commentaire : c'est un choix, pas un oubli.

## 4. Filtre et pagination dans le même gestionnaire

Incorrect (`src/app/webmaster/commandes/page.tsx`, `src/app/webmaster/catalogue/page.tsx`) :

```tsx
useEffect(() => {
  fetchOrders();
}, [fetchOrders]); // fetchOrders dépend de page ET des filtres
useEffect(() => {
  setPage(1);
}, [search, status, shopFilter]); // 2e rendu ⇒ 2e requête
```

Sur la page 3, changer le statut lance une requête « page 3 + nouveau statut » puis une requête
« page 1 + nouveau statut » ; sans annulation, la première peut arriver en dernier et s'afficher.

Correct : l'événement change les deux états d'un coup, l'effet de chargement est annulable (§ 6).

```tsx
function changeStatus(next: string) {
  setStatus(next);
  setPage(1);
}
<select value={status} onChange={(e) => changeStatus(e.target.value)}>
  …
</select>;
```

## 5. Prévenir le parent sans effet

Incorrect (`src/components/location/LocationPicker.tsx`) :

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  onLocationChange?.(latitude, longitude, city);
}, [latitude, longitude, city]);
```

Le commentaire porte sur la ligne `useEffect(…` ; l'avertissement vise le tableau de dépendances et
sort quand même. Et le parent apprend le changement un rendu trop tard.

Correct quand le changement vient d'un événement du composant : prévenir dans le même gestionnaire.

```tsx
function chooseSlot(slot: PickupSlot) {
  setSelectedStart(slot.start);
  onSlotChange(slot); // le parent l'apprend dans le même rendu
}
```

Correct quand la valeur change de façon asynchrone dans un hook (`useGeolocation().setManualCity`
ne renvoie rien, il pose son état) : remonter l'état. Le parent appelle `useGeolocation()` et passe
la position et les actions en props ; il n'y a plus rien à « notifier ».

## 6. Fetch gardé et annulable (favoris)

Incorrect : appel pour chaque visiteur, aucune annulation, erreur avalée.

```tsx
useEffect(() => {
  fetch("/api/favorites")
    .then((r) => r.json())
    .then((j) => setFavorites(j.data))
    .catch(() => {});
}, []);
```

Correct (même logique que `src/app/(client)/decouvrir/NearbyShops.tsx`) :

```tsx
type Favorites = readonly string[] | null | "error"; // null = pas encore chargé

function readShopIds(body: unknown): readonly string[] {
  const data = (body as { data?: unknown } | null)?.data; // forme { success, data } d'apiSuccess
  if (!Array.isArray(data)) throw new Error("Réponse /api/favorites inattendue");
  return data.map((shop: { id: string }) => shop.id);
}

const { isLoaded, isSignedIn } = useAuth();
const canLoad = (isLoaded && !!isSignedIn) || hasTestModeCookie();
const [favorites, setFavorites] = useState<Favorites>(null);

useEffect(() => {
  if (!canLoad) return;
  let ignore = false;
  async function load() {
    let res: Response;
    try {
      res = await fetch("/api/favorites");
    } catch {
      if (!ignore) setFavorites("error");
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

Le `as` du parseur est la seule conversion, commentée ; schéma Zod si la réponse grossit
(`typescript-patterns` § 1). Pour un visiteur anonyme, l'état reste `null` : le composant affiche
l'appel à se connecter, sans requête.

## 7. Créneaux de retrait : course entre deux dates

Incorrect (`fetchSlots` de `src/app/(client)/panier/page.tsx`) : deux clics rapides sur « jour
suivant » lancent deux requêtes ; si celle du premier jour répond en dernier, la liste affichée est
celle d'un autre jour que la date sélectionnée.

Correct :

```tsx
useEffect(() => {
  if (timeMode !== "slot" || !shopId) return;
  let ignore = false;
  setSlotsLoading(true);
  async function load() {
    let res: Response;
    try {
      res = await fetch(`/api/shops/${shopId}/available-slots?date=${selectedDate}`);
    } catch {
      if (!ignore) {
        setSlots("error");
        setSlotsLoading(false);
      }
      return;
    }
    const body: unknown = res.ok ? await res.json() : null;
    if (ignore) return;
    setSlots(res.ok ? readSlots(body) : "error"); // readSlots : parseur local, comme § 6
    setSlotsLoading(false);
  }
  void load();
  return () => {
    ignore = true;
  };
}, [timeMode, shopId, selectedDate]);
```

Le filtrage des créneaux passés relève de `click-and-collect` (heure de Paris, `paris-time.ts`).

## 8. Rafraîchissement périodique

Demande type : « rafraîchis les commandes actives toutes les 30 s ».

Incorrect :

```tsx
useEffect(() => {
  const iv = setInterval(fetchActive, 30_000); // tourne onglet caché, sans backoff
  return () => clearInterval(iv);
}, [fetchActive]);
```

Correct (modèle `src/components/order/ActiveOrderBanner.tsx`) :

```tsx
const { isLoaded, isSignedIn } = useUser();
const [order, setOrder] = useState<ActiveOrder | null>(null);
const canPoll = (isLoaded && !!isSignedIn) || hasTestModeCookie();

const fetchActive = useCallback(async () => {
  const res = await fetch("/api/orders");
  if (!res.ok) return false; // false ⇒ nouvel essai puis backoff
  setOrder(pickActiveOrder(await res.json())); // parseur local
  return true;
}, []);

useVisiblePolling(fetchActive, 30_000, canPoll);
```

`fn` peut lever : `useVisiblePolling` compte l'échec. Un composant qui suit **une** commande
s'arrête sur son état final : `enabled` à `false`, ou `startVisiblePolling` avec un délai `null`
(modèle `nextOrderPollDelay`, `/commande/[id]`). Statuts : `src/lib/order-state-machine.ts`.

## 9. Horloge après montage

Incorrect (ancien `EstimatedCountdown` de `SuiviClient.tsx`, rendu côté serveur, corrigé par le
chantier C1-INVITES) :

```tsx
const [now, setNow] = useState(Date.now()); // heure du serveur dans le HTML
// …
new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); // fuseau UTC sur Vercel
```

Correct :

```tsx
import { PARIS_TIME_ZONE } from "@/lib/paris-time";

const [now, setNow] = useState<number | null>(null); // null au rendu serveur et à l'hydratation
useEffect(() => {
  setNow(Date.now());
  const iv = setInterval(() => setNow(Date.now()), 1_000);
  return () => clearInterval(iv);
}, []);
if (now === null) return null; // ou un squelette de même hauteur (CLS)

const pickupLabel = new Date(estimatedReady).toLocaleTimeString("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: PARIS_TIME_ZONE,
});
```

Modèle dans le dépôt : `src/app/(client)/suivi/[id]/EstimatedCountdown.tsx` (squelette de même
hauteur tant que `now` vaut `null`). Valeur lue une seule fois : `useMountedNow()`
(`src/components/product/ProductCard.tsx`).

## 10. Abonnement externe : `useSyncExternalStore`

Incorrect : lecture au rendu qui ne suit pas les changements (`prefersReducedMotion` de
`src/components/checkout/OrderCountdown.tsx`), ou effet + `setState` (`OfflineBanner.tsx`).

```tsx
const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Correct : `subscribe` défini hors du composant (stable), instantané primitif, valeur serveur neutre.

```tsx
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false // serveur et hydratation
  );
}
```

`getSnapshot` renvoie une primitive ou la même référence tant que rien ne change ; un nouvel objet
à chaque appel fait boucler React. Nouveau hook ⇒ `src/hooks/use-xxx.ts` (`architecture-conventions` § 6).

## 11. Gestionnaire async d'une action boucher

Incorrect : rejet non traité, bouton réactivable pendant l'envoi.

```tsx
<Button
  onClick={async () => {
    await fetch(`/api/boucher/orders/${order.id}/action`, { method: "PATCH", body });
    toast.success("Commande acceptée");
  }}
>
  Accepter
</Button>
```

Correct :

```tsx
const [pending, setPending] = useState(false);
const [error, setError] = useState<string | null>(null);

async function accept() {
  if (pending) return;
  setPending(true);
  setError(null);
  let res: Response;
  try {
    res = await fetch(`/api/boucher/orders/${order.id}/action`, { method: "PATCH", body });
  } catch {
    setError("Connexion perdue. La commande n'a pas été acceptée.");
    setPending(false);
    return;
  }
  setPending(false);
  if (res.status === 409) setError("La commande a changé d'état. Liste rafraîchie.");
  else if (!res.ok) setError("Action refusée.");
  else toast.success("Commande acceptée");
}

<Button onClick={() => void accept()} disabled={pending} aria-busy={pending}>
  Accepter
</Button>;
{
  error && (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {error}
    </p>
  );
}
```

Rejeu → 200 `_idempotent` et 409 sur autre statut : contrat de `transition.ts`
(`order-lifecycle-realtime`). Commande client : `idempotencyKey` créée dans le gestionnaire et
conservée entre deux essais (`click-and-collect`, modèle `handleOrder` du panier).

## 12. Dépendances d'effet sans `eslint-disable`

Incorrect (`src/app/(boucher)/boucher/support/[ticketId]/page.tsx`) :

```tsx
async function load() {
  /* fetch du ticket, setTicket, setLoading */
}
useEffect(() => {
  load();
}, [ticketId]); // dépendance manquante + promesse flottante
```

Correct : la fonction vit dans l'effet, qui devient annulable.

```tsx
useEffect(() => {
  let ignore = false;
  async function load() {
    let res: Response;
    try {
      res = await fetch(`/api/support/tickets/${ticketId}`);
    } catch {
      if (!ignore) {
        setLoadError(true);
        setLoading(false);
      }
      return;
    }
    const body: unknown = res.ok ? await res.json() : null;
    if (ignore) return;
    setTicket(res.ok ? readTicket(body) : null);
    setLoadError(!res.ok);
    setLoading(false);
  }
  void load();
  return () => {
    ignore = true;
  };
}, [ticketId]);
```

Une fonction qui ne lit ni props ni état sort du composant ; un rappel reçu en prop et appelé par un
effet de longue durée passe par `useVisiblePolling` (qui garde la dernière version) plutôt que par
une ref écrite au rendu.

## 13. Liste éditable : clé stable

Incorrect (options de découpe de `ProductForm.tsx` et `ProductFormPage.tsx`) :

```tsx
{
  cutOptions.map((opt, idx) => (
    <div key={idx}>
      …<button onClick={() => remove(idx)}>…</button>
    </div>
  ));
}
```

Supprimer la ligne 2 fait glisser l'état interne (focus, saisie en cours) vers la ligne suivante.

Correct : identifiant créé à l'ajout, dans le gestionnaire.

```tsx
type CutOptionDraft = { key: string; name: string; priceCents: number };

function addCutOption(priceCents: number) {
  setCutOptions((list) => [...list, { key: crypto.randomUUID(), name: "", priceCents }]);
}
{
  cutOptions.map((opt) => <CutOptionRow key={opt.key} option={opt} />);
}
```

La clé locale ne part pas au serveur (le payload garde `name` et `priceCents`).

## 14. Hasard et identifiants au rendu

Incorrect : `ConfettiBurst` (`src/app/(client)/commande/[id]/page.tsx`) tire `Math.random()` à chaque
rendu, alors que la page se re-rend à chaque sondage ; `QRScanner` (`src/components/boucher/`)
évalue `Math.random()` à chaque rendu pour un identifiant DOM.

Correct :

```tsx
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  angle: (i / 24) * 360,
  distance: 60 + ((i * 37) % 80), // pseudo-aléatoire déterministe
  size: 4 + (i % 4),
  delay: (i % 6) * 0.05,
})); // constante de module, calculée une fois

const readerId = `qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`; // modèle BrandLogo.tsx
```

## 15. Reducer pur

Quand plusieurs états changent ensemble (formulaire, panier), un reducer exporté et testé sans DOM
remplace les `setX` dispersés. Modèle : `cartReducer` de `src/lib/cart/cart-line.ts` — chaque cas
renvoie un nouvel objet, `switch` exhaustif sur l'union `CartAction`, aucune horloge ni E/S, test
dans `src/lib/__tests__/cart-line.test.ts`. Les effets (persistance, synchronisation réseau) restent
dans le provider (`src/lib/hooks/use-cart.tsx`), pas dans le reducer.
