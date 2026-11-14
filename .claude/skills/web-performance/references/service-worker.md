# Service worker (`public/sw.js`) : audit et cible

Enregistré sur toutes les pages par `src/components/pwa/ServiceWorkerRegistration.tsx`, monté
dans `src/app/layout.tsx`. `src/components/pwa/PushPrompt.tsx` appelle aussi
`register("/sw.js")`, mais n'est monté nulle part aujourd'hui (skill
`background-jobs-notifications`) ; un second `register` de la même URL serait sans effet (W7).
Le fichier porte aussi les notifications push (`push`, `notificationclick`) : **toute
modification doit les préserver**.

## Ce que fait le fichier aujourd'hui

| Requête | Stratégie | Problème |
| --- | --- | --- |
| Non-GET, `/api/*`, Clerk | Ignorée (réseau) | Correct |
| `/_next/static/*`, extensions `js css png … mp3`, `/icons/`, `/images/`, `/sounds/` | Cache d'abord, jamais revalidé | Correct pour `/_next/static` (noms hachés). **Faux pour `public/`** : un fichier remplacé à la même URL (icône, `og-image.png`, son) reste servi périmé tant que `CACHE_NAME` ne change pas |
| Tout le reste en GET (pages HTML, charges RSC `?_rsc=…`, `/_next/image?…`) | Réseau d'abord, **chaque réponse 200 stockée** | Voir ci-dessous |
| Hors ligne | Copie en cache, sinon `/offline.html` | Correct dans l'intention |

« Réseau d'abord » pour le HTML est une stratégie classique (W8). Ce qui pose problème ici est ce
qu'on stocke et l'absence de limite :

1. **Croissance sans limite** : chaque navigation et chaque préchargement App Router est un GET
   dont le paramètre `_rsc` est un hachage de l'état du routeur (I7) : une même URL de
   destination a autant de variantes que de pages d'où l'on vient, et chaque image optimisée a
   son URL. Tout s'accumule dans `klikgo-v1`, sans expiration ni plafond (W8 : `Cache-Control`
   n'a aucun effet sur ce que l'API Cache conserve).
2. **Pages privées stockées sur l'appareil** : `/commandes`, `/profil`, `/panier`,
   `/boucher/...` (tablette de boutique partagée) sont copiées dans CacheStorage et resservies hors
   ligne, après déconnexion comprise.
3. **`CACHE_NAME` figé** (`klikgo-v1`) : le nettoyage d'`activate` ne supprime donc jamais rien.
4. **`skipWaiting()` inconditionnel** : une page chargée sous l'ancienne version peut voir ses
   requêtes suivantes servies par la nouvelle (W7). Acceptable tant que le worker ne sert que des
   actifs hachés ; risqué avec le cache HTML actuel.
5. **`"/"` précaché** : HTML d'un build donné, qui référence des chunks d'un ancien déploiement.
6. **Aucun filtre d'origine** : les GET vers d'autres domaines (hors Clerk) passent aussi par le
   gestionnaire.

## Cible recommandée (plus simple que l'existant)

- HTML : **réseau seul**, repli `/offline.html` en cas d'échec de navigation. Ne rien stocker.
- `/_next/static/*` : cache d'abord (immuable). Optionnel : ne pas l'intercepter du tout, le
  cache HTTP du navigateur suffit pour des fichiers hachés.
- `public/` (icônes, sons, images) : non interceptés, le cache HTTP du navigateur s'en charge.
  Les sons du mode cuisine n'en dépendent pas : `src/lib/notification-sound.ts` les charge une
  fois au déverrouillage audio et les garde décodés en mémoire ; `src/lib/sounds.ts` les
  synthétise.
- `/_next/image`, `?_rsc=`, `/api/*`, autres origines : jamais interceptés.
- `CACHE_NAME` versionné à chaque changement du fichier ; `activate` supprime les autres caches.

```js
// public/sw.js — stratégie cible ; garder tel quel le bloc push / notificationclick
const CACHE_NAME = "klikgo-v2"; // incrémenter à chaque modification de ce fichier
const OFFLINE_URL = "/offline.html"; // page autonome : aucun autre fichier à précacher

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.status === 200) {
              const copy = response.clone();
              event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
            }
            return response;
          }),
      ),
    );
  }
});
```

Extrait vérifié en syntaxe seulement (`node --check`) : il n'a tourné dans aucun navigateur, le
tester avant de fusionner.

Le passage à cette version libère les anciens contenus au premier `activate` (nom de cache
différent). `skipWaiting()` est retiré : la nouvelle version attend qu'aucun onglet ne soit plus
contrôlé par l'ancienne, ce qui évite le mélange de versions (W7). Revers : une tablette cuisine
jamais fermée garde l'ancien worker (et son code push) longtemps. Si une mise à jour immédiate est
voulue, la déclencher par `postMessage` après action de l'utilisateur (W7) ; pour ce **premier**
passage, garder `self.skipWaiting()` dans `install` afin de purger vite le cache actuel.

## Vérification

1. DevTools > Application > Service Workers : nouvelle version active ; Cache Storage : un seul
   cache, quelques entrées, aucune page HTML ni `_rsc`.
2. Mode hors ligne + navigation : `/offline.html` s'affiche.
3. Notification push de test (skill `background-jobs-notifications`) : affichée, clic qui ouvre
   la bonne commande.
4. Après déconnexion sur la tablette : aucune page de commande servie hors ligne.
5. Mode cuisine ouvert, réseau coupé puis rétabli : le son d'alerte joue toujours à la commande
   suivante (les sons sont en mémoire, le worker n'y est pour rien : simple contrôle de
   non-régression).

Workbox (G4) n'est pas nécessaire pour ce périmètre ; à reconsidérer seulement si un vrai mode
hors ligne (catalogue consultable sans réseau) devient un besoin produit.
