# E-mail transactionnel avec Resend : délivrabilité, retours, désinscription

SDK installé : `resend` 6.9.1 (`resend/resend-node` : 978 étoiles, sous le seuil, retenu comme SDK
officiel du fournisseur déjà choisi). Webhooks signés par Svix (`svix` 1.84.1, déjà utilisé par
`src/app/api/webhooks/clerk/route.ts`).

## 1. Domaine et DNS (à faire une fois, par le propriétaire)

État actuel : voir `etat-du-code.md`, C1, et le registre privé du programme.

1. **Envoyer depuis un sous-domaine**, pas depuis la racine : Resend le recommande pour isoler la
   réputation d'envoi [RS1]. La racine reçoit déjà le courrier de Google (MX `smtp.google.com`) : ne pas
   toucher à ses MX. Nom à choisir (point à arbitrer), par exemple `notifications.klikandgo.app`.
2. **Ajouter les enregistrements affichés par Resend** pour ce sous-domaine : MX et TXT SPF sur
   `send.<sous-domaine>`, TXT DKIM sur `resend._domainkey.<sous-domaine>` ; copier les valeurs du tableau
   de bord, celles des guides ne sont que des exemples [RS2].
3. **DMARC** : TXT `_dmarc.klikandgo.app` = `v=DMARC1; p=none; rua=mailto:<boîte de rapports>;`, puis,
   quand tous les envois légitimes passent (Resend, Google Workspace, tout outil marketing),
   `p=quarantine`, puis `p=reject`, en gardant `rua` [RS3]. Un message passe DMARC si SPF **ou** DKIM
   passe et est aligné sur le domaine `From` [RS3][G1]. **Avant de quitter `p=none`** : vérifier que
   le courrier Google de `@klikandgo.app` est authentifié (SPF et DKIM de la messagerie Google, publiés
   dans le DNS [G1]), sinon la politique mettra en quarantaine les e-mails envoyés par le fondateur
   depuis sa boîte.
4. Vérifier : un envoi de test vers Gmail, en-têtes `dkim=pass`, `dmarc=pass`.

Exigences Gmail [G1] : tous les expéditeurs : SPF ou DKIM, TLS, taux de plainte sous 0,3 % (viser
0,1 %). Au-delà de 5 000 messages par jour vers Gmail : SPF **et** DKIM **et** DMARC (`p=none`
accepté), alignement, et pour les messages marketing une désinscription en un clic (`List-Unsubscribe` +
`List-Unsubscribe-Post: List-Unsubscribe=One-Click`, RFC 8058) plus un lien visible. Nous en sommes
loin, mais DMARC et la désinscription coûtent peu et se posent maintenant.

Capacité : offre gratuite Resend 3 000 e-mails par mois et **100 par jour**, 3 domaines ; Pro 20 $
par mois pour 50 000, sans plafond journalier [RS8]. Le code envoie aujourd'hui jusqu'à 7 e-mails par
commande menée au retrait (`etat-du-code.md` § 2) : le plafond gratuit est atteint à la 15e commande de
la journée, et un mois gratuit couvre environ 430 commandes. Les envois suivants échouent en `429`
(`daily_quota_exceeded` / `monthly_quota_exceeded`) [RS9]. Deux leviers : choisir l'offre avant le
lancement commercial, et réduire le nombre d'e-mails par commande (« en préparation » peut se limiter au
push et à l'in-app, « retirée » fait doublon avec le reçu : décision produit, `click-and-collect`).

Débit : 10 requêtes par seconde pour toute l'équipe Resend, `429` au-delà avec `retry-after` [RS9]. Sans
effet sur les e-mails de commande, décisif pour un envoi en masse (§ 4).

## 2. Envoyer correctement (patron compilé [L1])

```ts
import { Resend } from "resend";
import { logger } from "@/lib/logger";

export type EmailResult = { ok: true; id: string } | { ok: false; retryable: boolean; reason: string };
let resendClient: Resend | null = null;

export async function deliverEmail(input: {
  to: string; subject: string; html: string; text?: string;
  idempotencyKey?: string; category: "transactional" | "marketing"; unsubscribeUrl?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[email] RESEND_API_KEY missing: e-mail NOT sent", { subject: input.subject });
      return { ok: false, retryable: false, reason: "not_configured" };
    }
    logger.info("[email] stub (dev)", { to: input.to, subject: input.subject });
    return { ok: true, id: "stub" };
  }
  resendClient ??= new Resend(apiKey);
  const headers: Record<string, string> = {};
  if (input.category === "marketing" && input.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const { data, error } = await resendClient.emails.send(
    {
      from: "Klik&Go <commandes@notifications.klikandgo.app>", // sous-domaine vérifié (à arbitrer, B3)
      replyTo: "contact@klikandgo.app", // boîte citée par les gabarits prospects ; vérifier qu'elle est lue (B3)
      to: input.to, subject: input.subject, html: input.html, text: input.text,
      headers, tags: [{ name: "category", value: input.category }],
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  );
  if (error) { // le SDK ne lève pas : il renvoie { data, error }
    const status = error.statusCode;
    const retryable = status === null || status === 429 || status >= 500 || error.name === "concurrent_idempotent_requests";
    return { ok: false, retryable, reason: `${error.name}: ${error.message}` };
  }
  return { ok: true, id: data.id };
}
```

- Garder `sendEmail(to, subject, html): Promise<boolean>` comme enveloppe (`return (await deliverEmail(...)).ok`)
  tant que ses appelants et le simulacre de `tests/integration/notifications/order-notifications.test.ts`
  l'utilisent ; migrer ensuite.
- Clé d'idempotence : jusqu'à 256 caractères, retenue 24 h ; même clé + même contenu = même réponse sans
  renvoi ; même clé + contenu différent = `409 invalid_idempotent_request` ; requête en cours =
  `409 concurrent_idempotent_requests`, à réessayer [RS4]. Prendre l'`id` de la ligne outbox, ou
  `<event>:<orderId>`. Attention : un gabarit qui contient l'heure d'envoi change le contenu entre deux
  tentatives.
- `429` regroupe le débit (réessayer après `retry-after`) et les quotas journalier ou mensuel
  (`error.name` `daily_quota_exceeded` / `monthly_quota_exceeded`) [RS9] : pour ces deux noms, réessayer
  dans l'heure n'aboutira pas. Les journaliser en `logger.error` dès la première occurrence (alerte), le
  rejeu servant seulement si le quota se renouvelle avant l'abandon.
- Toujours une version `text` (les gabarits ont déjà un `plainText` dans `notifications.ts`).
- `replyTo` vers une boîte lue ; supprimer « merci de ne pas y répondre » du pied de page dès que les
  e-mails invitent à répondre (relances prospects, C4).

## 3. Rebonds, plaintes, suppression

- Resend ajoute à sa liste de suppression toute adresse en rebond définitif ou en plainte ; les envois
  suivants vers elle sont ignorés, sur tous les domaines de l'équipe. Gmail et Google Workspace ne
  renvoient pas les plaintes [RS7] : l'absence de plainte ne prouve rien. Retirer une adresse de la liste
  sans corriger la cause la fait re-supprimer.
- Notre base doit le savoir aussi, pour ne pas compter le canal comme servi : webhook
  `POST /api/webhooks/resend` (chemin déjà exclu du middleware : `webhooks/`, donc aucun import
  `server-auth` / `boucher-auth` / `admin-auth`), signature Svix vérifiée sur le **corps brut** [RS5],
  événements `email.bounced` (rejet **permanent** ; un retard passager est `email.delivery_delayed`),
  `email.complained` et `email.suppressed` [RS10] → `notifEmail = false`, et affichage « adresse e-mail
  invalide » dans le profil.
- Resend rejoue un webhook en échec pendant environ 27 h 30 (immédiat, 5 s, 5 min, 30 min, 2 h, 5 h,
  10 h, 10 h ; durée totale calculée ici) et désactive un point d'accès qui échoue toujours [RS6] : le
  traitement doit être idempotent et rapide (répondre 2xx, travail lourd ailleurs).

```ts
// src/app/api/webhooks/resend/route.ts — compilé [L1]
import { NextRequest } from "next/server";
import { Webhook } from "svix";
import type { WebhookEventPayload } from "resend";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return apiError("INTERNAL_ERROR", "Webhook secret not configured");
    const payload = await req.text(); // corps brut, jamais req.json() avant la vérification
    let event: WebhookEventPayload;
    try {
      event = new Webhook(secret).verify(payload, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      }) as WebhookEventPayload;
    } catch {
      return apiError("UNAUTHORIZED", "Invalid signature");
    }
    if (event.type === "email.bounced" || event.type === "email.complained" || event.type === "email.suppressed") {
      const { count } = await prisma.user.updateMany({
        where: { email: { in: event.data.to } },
        data: { notifEmail: false },
      });
      logger.warn("[webhooks/resend] E-mail channel disabled", { type: event.type, count });
    }
    return apiSuccess({ received: true });
  } catch (error) {
    return handleApiError(error, "webhooks/resend");
  }
}
```

`svix` directement plutôt que `resend.webhooks.verify` : le constructeur `new Resend()` lève sans clé
d'API (`Missing API key`, `node_modules/resend/dist/index.mjs`), le webhook n'en a pas besoin.
`notifEmail = false` coupe aussi les e-mails de commande : afficher la raison à l'utilisateur et lui
permettre de corriger son adresse. Zod n'est pas utile ici : le contenu est authentifié et typé par le SDK,
mais toute donnée réutilisée ailleurs se valide (`api-route-conventions`).

## 4. Transactionnel ou marketing : la ligne de partage

| Message | Nature | Consentement | Désinscription |
|---|---|---|---|
| Confirmation, acceptée, prête, annulée, reçu, ajustement de prix | transactionnel | aucun (exécution de la commande) | non requise ; ne jamais y glisser de promotion |
| Rappel « prête », commande programmée | transactionnel | aucun | idem |
| Panier abandonné, promo, offre flash, récompense fidélité | marketing (à confirmer avec `conformite-france` pour le panier abandonné) | particulier : consentement préalable, sauf client ayant déjà acheté un produit analogue [CNIL1] | lien visible + `List-Unsubscribe` en un clic [G1] |
| Relances prospects boucheries | prospection B2B | intérêt légitime si lié à la profession [CNIL1] | moyen simple de s'opposer dans **chaque** message [CNIL1] |
| Rapport hebdomadaire boucher | service au partenaire | contrat | réglage dans le tableau de bord |

La page de la CNIL ne traite que de la prospection : la qualification « transactionnel » (message
strictement lié à l'exécution de la commande, sans contenu promotionnel) et « service au partenaire » est
la lecture de ce skill, à faire confirmer par `conformite-france` avant d'en tirer une règle juridique.

Règles CNIL valables pour l'e-mail **et** le SMS [CNIL1] : case non pré-cochée, identité de l'expéditeur
visible, opposition simple et gratuite. La création d'un compte sans achat ne vaut pas « client existant »,
et l'acceptation des CGU ne vaut pas consentement. Les adresses génériques d'une entreprise (`contact@`,
`info@`) ne sont pas soumises à ces règles [CNIL1] ; l'adresse nominative d'un boucher, si.

### Désinscription : ce que le lien doit faire

- En-têtes `List-Unsubscribe: <https://…>` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
  couverts par la signature DKIM (donc domaine vérifié chez Resend) [RFC8058][G1], plus un lien visible
  dans le corps.
- La messagerie envoie un **`POST` sans cookie ni authentification** sur cette URL [RFC8058] : la route
  est publique, identifie la personne par un jeton **signé et impossible à deviner** porté par l'URL
  (HMAC d'un identifiant et de la catégorie, secret serveur dédié ; jamais l'e-mail ni l'`id` en clair),
  ne redirige pas, et répond 2xx sans demander de connexion.
- Le même lien ouvert dans un navigateur (`GET`) affiche une page de confirmation avec un bouton : ne pas
  désinscrire sur un simple `GET`, que les antivirus de messagerie pré-chargent (précaution de ce skill ;
  la RFC ne normalise que le `POST`).
- Effet : couper la **préférence marketing** seulement, jamais les e-mails de commande. Aujourd'hui une
  seule colonne (`notifEmail`) porte les deux : la séparation est le point B4.
- Emplacement : une route `/api/…` passe par le middleware (elle n'est pas dans ses exclusions) sans y
  être bloquée ; ne pas y importer d'aide d'authentification, valider le jeton avec Zod, limiter le débit
  (`api-route-conventions`).

### Envoi en masse (campagnes)

État actuel et défauts : `etat-du-code.md`, C7. Règles pour toute reprise de `send-campaign.ts` :

1. Destinataires = personnes dont le consentement marketing est établi ; jamais une requête sur `users`
   sans filtre de préférence.
2. Une ligne par destinataire (table d'envoi de campagne, clé unique `(campaignId, userId)`) réclamée par
   lots : la campagne devient reprenable et un second clic ne double rien. À défaut de migration, clé
   d'idempotence Resend `campaign:<campaignId>:<userId>`, qui ne protège que 24 h [RS4].
3. Hors de la requête HTTP de l'administrateur : un job borné (lots, budget) qui respecte 10 requêtes par
   seconde [RS9] ; `resend.batch.send` accepte 100 e-mails par appel, sans pièces jointes [RS11].
4. Jamais de rejeu automatique d'un envoi marketing en échec ; pas d'envoi la nuit (plage horaire à fixer
   par le propriétaire, en heure de Paris).
5. `scheduledAt` : soit un job l'honore, soit le champ disparaît du formulaire (B9).

## 5. Gabarits

- Échapper **toute** valeur interpolée (`esc()` de `email-templates.ts`, à exporter ou à déplacer dans
  un module partagé) ; une URL interpolée dans un `href` se construit à partir d'identifiants, jamais
  d'une saisie. Test unitaire : un `shopName` `<a href=…>` ressort échappé.
- Pas de `new Date()` dans un gabarit rejouable (changerait le contenu, donc l'idempotence) : passer la
  date dans les données, formatée en heure de Paris (`PARIS_TIME_ZONE`).
- `react-email` (`resend/react-email`, 19 936 étoiles, actif) n'est pas installé : utile si le nombre
  de gabarits grossit ; ne pas l'introduire sans arbitrage.
