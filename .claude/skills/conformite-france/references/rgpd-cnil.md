# RGPD et CNIL — détail pour l'ingénieur

Pas un avis juridique. Identifiants `[Cx]`, `[Sx]`, `[Vx]` → [sources.md](sources.md).

## 1. Grille « ce script a-t-il besoin du consentement ? »

Le principe (art. 82 de la loi 78-17) vise **tout stockage d'informations sur le terminal ou accès à
des informations déjà stockées** `[C2][S1]`. La CNIL cite les cookies, l'empreinte du terminal et les
pixels invisibles `[C2]` ; par construction, `localStorage`, `sessionStorage` et IndexedDB sont du
stockage sur le terminal : les traiter de la même façon.

| Question | Si oui |
|---|---|
| Strictement nécessaire au service demandé (connexion Clerk, panier, sécurité, mémorisation du choix de consentement, thème attendu) ? | Exempté `[C2]` — le lister quand même dans la politique |
| Mesure d'audience **pour le compte exclusif de Klik&Go**, statistiques **anonymes** uniquement, aucun recoupement avec d'autres traitements, aucun suivi de la navigation sur d'autres sites, pas de réutilisation par le fournisseur de l'outil ? | Exemptable `[C1]` : informer ; recommandations : traceur 13 mois, données 25 mois au plus ; vérifier le transfert hors UE. La CNIL ne « valide » aucun outil : c'est à nous de documenter chaque condition |
| Publicité, réseaux sociaux, pixel marketing, test A/B tiers ? | **Consentement préalable** ; rien ne se charge avant « Accepter » `[C2]` |
| Enregistrement de session (Sentry Replay) ? | Ni strictement nécessaire, ni statistique anonyme, et il écrit `sentryReplaySession` dans `sessionStorage` `[V3]` : le traiter comme soumis à consentement. Qualification : **[JURISTE]** (aucune page CNIL dédiée lue) |

Exigences du bandeau `[C2][S2]` : « Refuser » au même niveau qu'« Accepter » (déjà le cas dans
`src/components/AnalyticsConsent.tsx`), fermeture = refus (déjà le cas), **lien permanent pour
modifier son choix** sur chaque page (absent). À faire : un lien « Gérer mes choix » dans
`src/components/layout/SeoFooter.tsx` et dans la politique, qui efface la clé `localStorage`
`klikgo-analytics-consent` et rouvre le bandeau. Le choix reste dans le navigateur : aucun appel API
au montage (CLAUDE.md « Coût CPU Vercel »).

État du code, revérifié le 2026-11-14 :

| Outil | Où | Situation |
|---|---|---|
| Plausible | `AnalyticsConsent.tsx` (`next/script`, après « Accepter ») | Prudent : sans cookie, hash quotidien, données dans l'UE `[V2]`. Reçoit le **chemin** de la page (donc l'identifiant de `/suivi/[id]`), pas la chaîne de requête `[V2]`. Le bandeau entier ne s'affiche que si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` est défini |
| Vercel Web Analytics | `<Analytics />` dans `src/app/layout.tsx` | Chargé pour tous, **non mentionné** ; hash de requête 24 h, URL, paramètres de requête « filtrés », pays/région/ville `[V1]` ; Vercel est une société américaine |
| Vercel Speed Insights | `<SpeedInsights />` dans `layout.tsx` | Chargé pour tous, non mentionné ; stocke route, URL, pays `[V1c]` |
| Sentry Replay | `sentry.client.config.ts` (`replaysSessionSampleRate: 0.05`, `replaysOnErrorSampleRate: 1.0` en production, `maskAllText`, `blockAllMedia`) | Enregistrement de session sans consentement ni mention → point à arbitrer n° 1. `reliability-observability` demande de garder ces réglages tant que l'arbitrage n'est pas rendu : ne pas modifier ce fichier sans décision de l'owner |
| `localStorage` | panier, `klikgo-analytics-consent`, `theme`, `klikgo-geo`, `popup_seen_*` / `popup_day_*` | Panier, thème et choix : exemptés `[C2]` ; fréquence de la popup d'offre (marketing) : à classer **[JURISTE]** |
| `<link rel="preconnect">` vers `fonts.googleapis.com` et `fonts.gstatic.com` | `layout.tsx` | Ouvre une connexion vers Google pour chaque visiteur alors que `next/font/google` auto-héberge les polices `[V4]` → point à arbitrer n° 8 (CLAUDE.md cite ce preconnect) |
| Géocodage inverse | `src/hooks/useGeolocation.ts` → `nominatim.openstreetmap.org` | Latitude et longitude envoyées à un tiers depuis le navigateur, non mentionné dans la politique. La directive `connect-src` de `next.config.mjs` ne liste pas cet hôte : l'appel est probablement bloqué en production (à vérifier dans l'onglet Réseau) |

Le libellé du bandeau « Aucune donnée personnelle n'est collectée » est faux tant que des URL
contenant des identifiants partent vers Vercel (§ 2). Corriger le texte **et** le comportement.

## 2. Ne pas envoyer d'identifiant à l'analytique

Routes à risque : `/suivi/[id]` (avec `?guestToken=` : `panier/page.tsx` redirige l'invité vers
`/suivi/<id>?guestToken=<jeton>`), `/commande/[id]`, `/validation/[id]`, et toute URL `?testmode=<secret>`
sur un déploiement de recette. Vercel Analytics **et** Speed Insights stockent l'URL `[V1][V1c]`.

`layout.tsx` est un Server Component et `Analytics` est un composant `"use client"` `[V3]` : une
fonction `beforeSend` ne peut pas lui être passée depuis le layout (non sérialisable). L'exemple App
Router de la documentation Vercel `[V1b]` ne vaut que pour un layout client. Créer une fonction pure
et un petit composant client. Code compilé contre nos versions (`tsc` strict) et testé :

```ts
// src/lib/analytics/redact-url.ts — pure, à tester dans src/lib/__tests__/redact-url.test.ts
const ROUTE_WITH_ID = /^\/(suivi|commande|validation)\/[^/]+/;
const BASE = "https://klikandgo.app";

/** URL sans identifiant de commande ni paramètre de requête, sauf utm_* ; null si illisible. */
export function redactUrl(raw: string): string | null {
  try {
    const url = new URL(raw, BASE);
    url.pathname = url.pathname.replace(ROUTE_WITH_ID, "/$1/[id]");
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key.startsWith("utm_")) kept.append(key, value);
    });
    url.search = kept.toString();
    url.hash = "";
    return raw.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return null;
  }
}
```

```tsx
"use client";
// src/components/PrivateAnalytics.tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { redactUrl } from "@/lib/analytics/redact-url";

function redact<T extends { url: string }>(event: T): T | null {
  const url = redactUrl(event.url);
  return url === null ? null : { ...event, url }; // null : l'événement n'est pas envoyé
}

export function PrivateAnalytics() {
  return (
    <>
      <Analytics beforeSend={redact} />
      <SpeedInsights beforeSend={redact} />
    </>
  );
}
```

Dans `layout.tsx`, remplacer `<SpeedInsights />` et `<Analytics />` par `<PrivateAnalytics />`
(ne jamais ajouter la prop `dynamic` à `ClerkProvider`, cf. CLAUDE.md). Liste **blanche** de
paramètres (`utm_*`) plutôt que liste noire : un futur jeton en query string est retiré par défaut.
Résultats attendus du test : `/suivi/abc?guestToken=x` → `/suivi/[id]` ; `/?testmode=s` → `/` ;
`/boutique/foo?utm_source=a&ref=b` → `/boutique/foo?utm_source=a` ; `/commandes` inchangé.

Plausible : il reçoit le chemin `[V2]`. Tant qu'il n'existe pas d'équivalent vérifié, ne pas rendre
`<AnalyticsConsent />` actif sur ces trois routes, ou lire la documentation Plausible avant de
personnaliser l'URL envoyée (API non vérifiée ici : ne rien inventer).

## 3. Politique de confidentialité — contenu attendu

Au moment de la collecte, informer de `[S2]` : identité et coordonnées du responsable ; données,
finalités **et base légale** ; caractère obligatoire ou non des réponses ; destinataires ; durée ;
droits et manière de les exercer ; réclamation CNIL ; transferts hors UE. Document distinct des CGV
et des CGU, lien bien visible (le pied de page le porte déjà sur les pages client) `[S2]`.

Écarts de `src/app/(client)/politique-de-confidentialite/page.tsx` (« mars 2026 ») :
- responsable : « Klik&Go » sans nom de l'entrepreneur ni adresse → reprendre les mentions légales ;
- sous-traitants et destinataires cités : Clerk, Vercel, Railway, Resend, Upstash. Manquent ceux que
  le code appelle : Sentry, Vercel Analytics et Speed Insights, Plausible, Anthropic (chat et support),
  Replicate et Vercel Blob (images), Twilio (WhatsApp, `src/lib/whatsapp.ts`, si configuré), services
  push des navigateurs (web-push), Nominatim (§ 1) ; mécanisme de transfert par sous-traitant à
  préciser (DPF si l'entité est certifiée `[C6][C7]`, sinon clauses contractuelles types) —
  vérification de chaque certification : **[JURISTE]** ;
- base légale : décrire le consentement marketing tel que le code le recueille réellement (§ 5 ;
  état actuel : voir le registre privé du programme) ;
- durée unique « 3 ans à compter de votre dernière activité » : distinguer compte, commandes (pièces
  comptables 10 ans `[K1]`, en archive), prospects, avis, notifications `[C4]` ;
- rien sur les **boucheries prospectées** (`/webmaster/prospects`, source Google Places) : information
  au premier contact et opposition `[C3]` ;
- rien sur les **invités** (commande sans compte, `User.isGuest`) ni sur la géolocalisation ;
- section cookies contraire au code (§ 1).

## 4. Droits des personnes : export et suppression

Délai : 1 mois ; +2 mois si la demande est complexe, en prévenant dans le premier mois `[C5]`.
Demande faite depuis le compte connecté : pas de pièce d'identité, sauf doute raisonnable `[C5]`.
Copie gratuite, format électronique courant, transmission sécurisée `[C5]`.

**Export** (`src/app/api/users/me/export/route.ts`) : bon socle (auth, limitation de débit,
`no-store`). À compléter : favoris, note via `orders/[id]/rate` (`Order.rating`, `ratingComment`),
`LoyaltyReward`, `ShopCustomer`, `Cart`, `SupportTicket` et ses messages, `pushPromoEnabled`,
`isGuest`. Les `.catch(() => [])` masquent une erreur et produisent un export incomplet sans le
dire : préférer l'échec explicite. Aucun bouton dans `src/app/(client)/profil/page.tsx` : l'ajouter.
Hors export par nature : `ChatMessage` (clé de session, aucun lien utilisateur — lui donner une durée
de purge) et `Referral` (parrainage entre boutiques).

**Suppression** (`DELETE /api/users/me`, `src/app/api/users/me/route.ts`) : anonymise nom, e-mail,
téléphone, SIRET, abonnement push, mais conserve `address`, `city`, `latitude`, `longitude`,
`notifEmail`, `pushPromoEnabled`, et ne supprime pas le compte **Clerk** (e-mail, identifiants et
sessions restent chez le sous-traitant). Les commandes restent, rattachées au profil anonymisé
(obligation comptable `[K1]`).

Ordre recommandé (décision d'ingénierie) : contrôles (commandes actives) → suppression chez Clerk →
anonymisation Prisma, avec **une seule fonction d'anonymisation** partagée par la route et par le
webhook `user.deleted`. Raison : si l'anonymisation échoue après la suppression Clerk, le webhook la
rejoue (la ligne porte encore le `clerkId`) ; dans l'ordre inverse, un échec côté Clerk laisse un
compte connecté que `getOrCreateUser` recrée en base. API vérifiée `[V3]`, extrait compilé :

```ts
import { clerkClient } from "@clerk/nextjs/server";
import { getTestRole } from "@/lib/auth/server-auth";

// Jamais pour un utilisateur de test (identifiants fictifs de TEST_USERS) :
if (getTestRole() === null) {
  const client = await clerkClient();
  await client.users.deleteUser(clerkId); // en cas d'échec : 5xx, rien n'est anonymisé, le client réessaie
}
// puis la fonction partagée : address, city, latitude, longitude, notifEmail, pushPromoEnabled,
// panier, LoyaltyReward non utilisées, en plus des champs déjà traités.
```

Aujourd'hui `src/app/api/webhooks/clerk/route.ts` traite `user.deleted` par
`prisma.user.update({ where: { clerkId: id } })` : si la ligne a déjà changé de `clerkId`, Prisma
lève P2025, la route répond en erreur et Svix rejoue. Passer à `updateMany` (idempotent). Test
d'intégration obligatoire (PostgreSQL réel ; `clerkClient` se mocke comme un helper d'auth, jamais
Prisma — CLAUDE.md « Tests »).

**Invités** : pas de compte, donc pas d'accès à ces routes. Leur demande arrive par e-mail : prévoir
une action admin qui appelle la même fonction d'anonymisation, après vérification que la demande
vient de l'adresse de la commande.

## 5. Marketing : consentement et destinataires

Règles `[C3]` : SKILL.md n° 4. Mécanique d'envoi et `List-Unsubscribe` : `background-jobs-notifications`.
Modèle de données minimal (migration avec `prisma-expert`) : préférence marketing **distincte** des
préférences transactionnelles, fausse par défaut, avec date et source du consentement (preuve).
Destinataires en Prisma typé, jamais en `$queryRaw` sans filtre. Le champ ci-dessous **n'existe pas
encore** (l'extrait ne compile qu'après la migration) :

```ts
const recipients = await prisma.user.findMany({
  where: {
    role: "CLIENT",
    deletedAt: null,
    marketingEmailOptIn: true, // à créer : Boolean @default(false) + date du consentement
  },
  select: { id: true, email: true },
  orderBy: { id: "asc" },
  take: 500, // puis pagination par curseur (CLAUDE.md : listes > 50)
});
```

- Toute sélection de destinataires de campagne suit le modèle ci-dessus (consentement, `deletedAt:
  null`, pagination) ; état actuel des envois : voir le registre privé du programme.
- Relance de panier abandonné (`src/app/api/cron/abandoned-carts/route.ts`, événement
  `CART_ABANDONED`) : sollicitation commerciale ; sans achat antérieur, elle exige le consentement
  `[C3]` — qualification **[JURISTE]**, même lecture que `background-jobs-notifications`.
- Prospection B2B (envoi manuel depuis `/webmaster/prospects`, relances automatiques, gabarits
  `prospect*`) : informer et permettre de s'opposer simplement dans **chaque** message `[C3]`. Une
  adresse générique de société (`contact@…`) échappe à ces règles, l'adresse nominative d'un boucher
  non `[C3]` : comme la base ne distingue pas les deux, appliquer la règle à tous. Cible : adresse de
  réponse réelle, lien d'opposition qui passe le prospect en `REFUSED`, refus d'envoi côté serveur
  pour un prospect `REFUSED`, purge à 3 ans `[C4]`. État actuel : voir le registre privé du programme.
- Allégations des gabarits (« Déjà 11 boucheries », « +15 à 30 % de chiffre d'affaires en 3 mois »,
  « première plateforme ») : n'écrire que ce qu'une donnée prouve ; chiffre calculé, jamais en dur.

## 6. Sous-traitants : checklist d'ajout

- [ ] Accord de sous-traitance (DPA) accepté ; localisation des données notée.
- [ ] Transfert hors UE : DPF (entité certifiée, à vérifier) ou clauses contractuelles types `[C7]`.
- [ ] Aucune donnée personnelle envoyée sans nécessité : prompts Anthropic, événements Sentry
      (`sendDefaultPii` n'est pas activé : le laisser ainsi), journaux (`src/lib/email.ts` journalise le
      destinataire en clair quand `RESEND_API_KEY` est absent — voir `security-multitenant`).
- [ ] Politique de confidentialité mise à jour dans la même PR.
