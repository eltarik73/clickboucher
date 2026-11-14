# Web Push, notifications in-app, SMS et WhatsApp

Le push vers la tablette du boucher (rôle d'alerte de la cuisine, onglet caché) est traité dans
`order-lifecycle-realtime` (`references/temps-reel-cuisine.md` § 7). Ici : le mécanisme commun, le
client, et les canaux payants.

## 1. Web Push : ce qu'il faut savoir

- Trois briques : Service Worker (`public/sw.js`), Push API (abonnement, `pushManager.subscribe`),
  Notifications API (affichage). Serveur : `web-push` 3.6.7 (`web-push-libs/web-push` : 3 572 étoiles,
  push 10/11/2026), clés VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`).
- `userVisibleOnly: true` est exigé par Chrome et Edge, qui rejettent l'abonnement sinon ; demander
  l'abonnement en réponse à un geste, Firefox refusant les demandes hors geste depuis la version 72 [MDN1].
- **iPhone / iPad** : à partir d'iOS 16.4, seulement pour une application **ajoutée à l'écran
  d'accueil** dont le manifeste a `display: standalone` ou `fullscreen`, et la permission ne peut être
  demandée qu'en réponse à une interaction directe (bouton) [WK1]. Le manifeste du dépôt est bien en
  `standalone` (`public/manifest.json`). Dans un onglet Safari, le push n'est donc pas offert : quand
  `"PushManager" in window` est faux sur iOS, proposer « Ajouter à l'écran d'accueil » au lieu du bouton
  (détection à constater sur un vrai iPhone).
- **Android / ordinateur** (Chrome, Edge, Firefox) : pas d'installation requise (comportement courant des
  navigateurs, non re-sourcé ici : à constater sur l'appareil lors du test).
- Le push n'est pas une garantie : pas d'accusé, délai variable, abonnement révocable à tout moment.
  Il signale ; la page relit l'état (`order-lifecycle-realtime`, règle 9).

### En-têtes d'envoi (RFC 8030 [RFC8030], options `TTL`, `urgency`, `topic` de `web-push`)

| En-tête | Sens | Notre règle |
|---|---|---|
| `TTL` (s) | durée de conservation si l'appareil est hors ligne ; `0` = maintenant ou jamais ; le service peut la réduire | commande : 600 à 3 600 s ; « prête » : 7 200 s ; marketing : 86 400 s. Jamais le défaut de 4 semaines de la bibliothèque |
| `Urgency` | `very-low`, `low`, `normal`, `high` ; `high` pour l'alerte urgente, `very-low` pour la publicité | `high` : nouvelle commande (boucher), « prête » ; `normal` : autres statuts ; `very-low` : marketing |
| `Topic` | un nouveau message de même sujet **remplace** celui en attente ; 32 caractères base64url au plus, sinon `400` | `o-<orderId>` pour les statuts d'une commande : le client hors ligne ne reçoit que le dernier. Un `id` de commande est un cuid de 25 caractères (27 avec le préfixe) ; `web-push` lève une erreur avant l'envoi au-delà de 32 ou hors de `[A-Za-z0-9_-]` |

Codes de réponse du service de push : `201` = message accepté, pas remis [RFC8030] ; `404` (abonnement
introuvable ou expiré [WD1][RFC8030 § 7.3]) et `410` (abonnement invalide [WD1]) → supprimer
l'abonnement ; `429` → respecter `Retry-After`, réessayer plus tard [WD1][RFC8030 § 8.4] ; `413` →
réduire la charge [WD1] ; `400` → en-tête invalide, bogue à corriger [WD1] ; `5xx` et délai réseau →
réessayer (convention HTTP, non détaillée par ces sources). **Jamais** supprimer un abonnement sur une
autre erreur (N5).

```ts
// remplace sendPushNotification (src/lib/push.ts) — compilé [L1]
import webpush, { WebPushError } from "web-push";

export type PushResult = { ok: true } | { ok: false; gone: boolean; retryable: boolean; status?: number };

export async function deliverPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url: string; tag?: string },
  options: { ttlSeconds: number; urgency: "very-low" | "low" | "normal" | "high"; topic?: string }
): Promise<PushResult> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: options.ttlSeconds, urgency: options.urgency, topic: options.topic, timeout: 5_000,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof WebPushError) {
      const status = error.statusCode;
      return { ok: false, status, gone: status === 404 || status === 410, retryable: status === 429 || status >= 500 };
    }
    // Réseau, délai de socket… mais aussi une option refusée par la bibliothèque (topic trop long,
    // urgency inconnue) : le nombre de tentatives de l'appelant doit être borné.
    return { ok: false, gone: false, retryable: true };
  }
}
```

`setVapidDetails` reste fait une fois (`ensureConfig`) ; sans clés en production, renvoyer un échec
journalisé (`logger.error`), pas `true`.

### Côté client

- Monter un composant d'activation **là où il sert** (page de suivi après une commande, réglages du
  profil, tableau de bord boucher), pas en fenêtre surgissante au chargement. `PushPrompt.tsx` existe mais
  n'est monté nulle part (N7) ; s'il est réutilisé : appeler `Notification.requestPermission()`
  **en premier** dans le gestionnaire de clic, avant tout `await fetch(...)` (aujourd'hui il attend
  d'abord `GET /api/push/subscribe` : précaution de ce skill, l'« interaction directe » exigée par iOS
  [WK1] ne survit pas forcément à une attente réseau). La clé VAPID se lit avant, au montage, sous la
  condition de CLAUDE.md : `(isLoaded && isSignedIn) || hasTestModeCookie()`
  (`src/lib/test-mode-client.ts`), jamais pour un visiteur anonyme.
- `POST /api/push/subscribe` écrase l'abonnement unique de l'utilisateur et remet `notifPush` à vrai :
  un second appareil désabonne le premier (A4 de `order-lifecycle-realtime`).
- Retirer la demande de permission au montage de `use-kitchen-notifications.ts` (hors geste : refusée
  sur iOS et Firefox [WK1][MDN1]) ; bouton « Activer les alertes » dans le mode cuisine.
- Composant client : `"use client"`, `isLoaded` testé, mode sombre, cible tactile ≥ 44 px, icônes Lucide
  (CLAUDE.md).
- Plusieurs appareils par utilisateur (tablette + téléphone du boucher) : table d'abonnements, point A4 de
  `order-lifecycle-realtime`.

### `public/sw.js`

- Toujours afficher une notification dans le gestionnaire `push` (abonnement `userVisibleOnly`) ; le
  `return` actuel sans `event.data` n'affiche rien.
- `renotify: true` avec `tag` : la mise à jour d'une commande re-sonne. Garder pour le boucher, inutile
  pour les statuts intermédiaires du client.
- Changer `sw.js` = changer `CACHE_NAME` si la stratégie de cache change ; tester sur un vrai téléphone
  installé (iOS) et sur Chrome Android.

## 2. Notifications in-app

- Une ligne `Notification` par événement et destinataire, écrite **dans la transaction** qui produit
  l'événement (même moment que l'outbox) : c'est l'historique que l'application affiche, indépendant de la
  réussite des canaux. `delivered` et `channel` ne doivent pas prétendre plus que la réalité (N10) : soit
  les retirer de l'affichage, soit les tenir à jour depuis l'outbox.
- Lecture : `GET /api/notifications` pagine (curseur `createdAt`, `take` ≤ 50 : règle CLAUDE.md) ; un
  compteur « non lues » léger s'appuie sur l'index `[userId, read]`. Rafraîchissement : `useVisiblePolling`,
  jamais pour un anonyme (CLAUDE.md, `vercel-cost-performance`).
- Marquer comme lu : `updateMany({ where: { id, userId } })` (périmètre dans le `WHERE`, `security-multitenant`).

## 3. SMS et WhatsApp pour les statuts de commande en France

| Canal | Coût unitaire relevé le 14/11/2026 | Contraintes | Verdict |
|---|---|---|---|
| Web Push | nul | appareil abonné ; iOS : application installée | canal principal pour « prête » |
| E-mail (Resend) | inclus dans l'offre [RS8] | lu en différé | trace écrite (confirmation, reçu) |
| SMS (Twilio, exemple) | 0,0798 $ par segment vers la France, plus frais d'opérateur éventuels et 0,001 $ par échec [TW2] | prospection : consentement préalable du particulier [CNIL1] ; numéro vérifié | seulement pour le boucher (nouvelle commande non vue) ou en secours de « prête », après arbitrage budgétaire |
| WhatsApp (API Business, via Twilio ou Meta) | facturation au message depuis le 01/07/2025 ; les modèles « utility » envoyés dans la fenêtre de service, gratuits jusque-là, sont facturés depuis le 01/10/2026 ; messages libres de service : 1 000 gratuits par mois et par numéro, facturés ensuite ; France = marché distinct, montant non lu [WA1] | hors fenêtre de 24 h ouverte par un message du client : **modèles approuvés uniquement** [WA1][TW1] ; accord préalable (opt-in) du destinataire requis [WA1] | à ne pas activer tant que modèles, opt-in et budget ne sont pas décidés |

Règles :

- Un canal payant est **opt-in explicite**, par canal, avec numéro vérifié ; jamais `true` par défaut
  (état actuel : voir le registre privé du programme).
- Un canal payant n'envoie que les événements qui le justifient (« prête », « nouvelle commande non vue
  depuis N minutes »), jamais le marketing sans consentement spécifique. Aujourd'hui `notifications.ts`
  envoie par WhatsApp **tout** événement, texte brut à défaut de modèle (C5) : à restreindre à une liste
  fermée avant toute activation.
- Pas de marketing la nuit, quel que soit le canal : `abandoned-carts` part à 05:00 ou 06:00 heure de
  Paris (push compris). Plage d'envoi à fixer par le propriétaire (B4) ; les règles horaires légales du
  démarchage n'ont pas été vérifiées ici (`conformite-france`).
- Le texte des modèles WhatsApp se déclare chez Meta : `whatsapp.ts` doit envoyer un identifiant de modèle
  et des variables (Twilio : `ContentSid` [TW1]), pas un `Body` libre.
- Désactiver le canal par variable d'environnement absente = **canal désactivé et journalisé**, pas
  « envoyé » (N4).
