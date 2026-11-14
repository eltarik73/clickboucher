# Patrons de code — auth Klik&Go

Chaque bloc ci-dessous a été compilé le 2026-11-13 avec le `tsc` 5.9.3 du dépôt contre les versions
installées (`@clerk/nextjs` 6.39.9, `@prisma/client` 6.19.2, `zod` 3.25.76, Next 14.2.35) et contre
nos propres helpers (`@/lib/...`), puis recompilé par le vérificateur le 2026-11-14 (branche de
travail, chantier prix compris). Ce sont des **modèles** : adapter les noms, garder la structure.
Le skill `api-route-conventions` vise des fabriques (`boucherRoute`, `adminRoute`…) qui
n'existent pas encore et appelleront ces mêmes helpers : les règles ci-dessous restent valables.
Les patrons d'autorisation (tenant dans le `where`, liste de champs, etc.) sont expliqués dans le
skill `security-multitenant`.

Ordre invariable d'un handler : `try` → authentification (helper) → rate limit si mutation ou
endpoint coûteux → validation Zod → requête scoppée → réponse `apiSuccess` / `apiError` →
`catch` → `handleApiError(error, "contexte")`.

## 1. Route client : identité Clerk → id Prisma

`getServerUserId()` renvoie l'id Clerk. Les tables métier portent l'id Prisma : résoudre avant de
comparer (règle « Résolution userId » de `CLAUDE.md`).

```ts
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!dbUser) return apiSuccess([]);

    const rewards = await prisma.loyaltyReward.findMany({
      where: { userId: dbUser.id },
      select: { id: true, code: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return apiSuccess(rewards);
  } catch (error) {
    return handleApiError(error, "loyalty/rewards");
  }
}

export async function findOwnedShop(clerkId: string, dbUserId: string) {
  return prisma.shop.findFirst({
    where: { OR: [{ ownerId: clerkId }, { ownerId: dbUserId }] },
    select: { id: true },
  });
}
```

## 2. Route boucher : `shopId` vient du helper, jamais du client

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// .strict() : une clé inconnue (shopId, isActive…) fait échouer la requête au lieu d'être ignorée.
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    priceCents: z.number().int().min(0).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.api, `product-patch:${auth.shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const data = patchSchema.parse(await req.json());

    // Le tenant est DANS le where : un id d'une autre boutique donne count = 0.
    const { count } = await prisma.product.updateMany({
      where: { id: params.id, shopId: auth.shopId },
      data,
    });
    if (count === 0) return apiError("NOT_FOUND", "Produit introuvable");

    const product = await prisma.product.findFirst({
      where: { id: params.id, shopId: auth.shopId },
      select: { id: true, name: true, priceCents: true },
    });
    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error, "boucher/products/patch");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;
    const { count } = await prisma.generatedImage.deleteMany({
      where: { id: params.id, shopId: auth.shopId },
    });
    if (count === 0) return apiError("NOT_FOUND", "Image introuvable");
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/images/delete");
  }
}

// Variante : update() accepte des filtres non uniques à côté de la clé unique (Prisma ≥ 5).
export async function updateScoped(id: string, shopId: string, name: string) {
  return prisma.product.update({
    where: { id, shopId },
    data: { name },
    select: { id: true, name: true },
  });
}
```

Pourquoi `updateMany` + `count` plutôt que `update` puis `catch` : notre `handleApiError`
reconnaît « introuvable » par le **texte** du message Prisma (`src/lib/api/errors.ts:160`), texte
que le moteur 6.19.2 n'émet plus sous cette forme (constat sur le binaire du moteur, non rejoué
contre une base) ; un `update` sans correspondance finirait en 500. Voir `security-multitenant`.

## 3. Route admin : `requireAdmin()` + journal d'audit

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ visible: z.boolean() }).strict();

export async function PATCH(req: NextRequest, { params }: { params: { shopId: string } }) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { visible } = bodySchema.parse(await req.json());
    const { count } = await prisma.shop.updateMany({ where: { id: params.shopId }, data: { visible } });
    if (count === 0) return apiError("NOT_FOUND", "Boutique introuvable");

    await writeAuditLog({
      actorId: admin.userId,
      action: "shop.visibility",
      target: "shop",
      targetId: params.shopId,
      details: { visible },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return apiSuccess({ visible });
  } catch (error) {
    return handleApiError(error, "admin/shops/visibility");
  }
}
```

`requireAdmin()` renvoie l'id **Clerk** dans `userId` ; ne pas le comparer à une clé étrangère
Prisma. Deux journaux, deux formats : `AuditLog.actorId` porte l'id Clerk (les 11 routes
`admin/**` et `webmaster/**` qui appellent `writeAuditLog`), alors que `OrderEvent.actorId`, écrit
par les commandes du chantier prix, porte l'id Prisma renvoyé par `getAuthenticatedBoucher()`.
Ne pas croiser les deux sans conversion.

## 4. Page serveur qui lit des données protégées

À réserver aux pages qui chargent réellement des données côté serveur : `getServerUserId()` rend
la route dynamique, et le chemin doit être dans `config.matcher` (sinon `auth()` lève).

```tsx
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { isAdmin } from "@/lib/roles";

// Garde serveur d'une page qui LIT des données protégées (Server Component).
export default async function AdminOnlyPage() {
  const clerkId = await getServerUserId();
  if (!clerkId) redirect("/admin-login");
  const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { role: true } });
  if (!isAdmin(dbUser?.role)) redirect("/");
  return <h1>Admin</h1>;
}
```

## 5. Composant client : aucun appel avant que Clerk soit chargé

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { hasTestModeCookie } from "@/lib/test-mode-client";

type Me = { id: string; role: string; firstName: string; lastName: string };

/** Profil Klik&Go de l'utilisateur connecté (GET /api/auth/me), ou null. */
export function useMe() {
  const { isLoaded, isSignedIn } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    // Anonyme ou Clerk pas encore chargé : aucun appel (coût CPU + jeton peut-être périmé).
    if (!((isLoaded && isSignedIn) || hasTestModeCookie())) {
      setMe(null);
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/auth/me", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { user?: Me | null } | null) => setMe(json?.user ?? null))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [isLoaded, isSignedIn]);

  // Trois états : chargement (isLoaded faux), connecté, déconnecté.
  return { me, isLoaded, isSignedIn: !!isSignedIn };
}
```

## 6. Webhook Clerk cible (idempotent, fusion des invités, marqueur après succès)

Remplace la logique actuelle de `src/app/api/webhooks/clerk/route.ts` (défauts W1 à W4 de
[roles-et-synchronisation.md](roles-et-synchronisation.md)). La route reste hors matcher : elle
n'importe aucun helper d'auth. `verifyWebhook` lit lui-même le corps brut et vérifie la signature ;
on lui passe notre variable existante `CLERK_WEBHOOK_SECRET`.

```ts
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { invalidateRoleCache } from "@/lib/auth/role-cache";

const ROLE_MAP: Record<string, Role> = {
  client: Role.CLIENT,
  client_pro: Role.CLIENT_PRO,
  client_pro_pending: Role.CLIENT_PRO_PENDING,
  boucher: Role.BOUCHER,
  admin: Role.ADMIN,
};

export async function POST(req: NextRequest) {
  // 1. Signature d'abord. Corps brut lu par le helper ; rien n'est cru avant.
  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret: process.env.CLERK_WEBHOOK_SECRET });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const deliveryId = req.headers.get("svix-id");
  const doneKey = deliveryId ? `webhook:clerk:done:${deliveryId}` : null;
  if (doneKey && (await redis.get(doneKey))) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;
      const primary =
        u.email_addresses.find((e) => e.id === u.primary_email_address_id) ?? u.email_addresses[0];
      const email = primary?.email_address?.toLowerCase();
      if (!email) return Response.json({ received: true, ignored: "no-email" });
      const emailVerified = primary?.verification?.status === "verified";

      const metadataRole = ROLE_MAP[String((u.public_metadata as { role?: unknown }).role ?? "")];
      const profile = {
        email,
        firstName: u.first_name ?? "",
        lastName: u.last_name ?? "",
        phone: u.phone_numbers[0]?.phone_number ?? null,
      };

      // 2. Écritures idempotentes : rejouer l'événement donne le même état.
      const byClerk = await prisma.user.findUnique({ where: { clerkId: u.id }, select: { id: true } });
      if (byClerk) {
        await prisma.user.update({
          where: { clerkId: u.id },
          data: { ...profile, ...(metadataRole ? { role: metadataRole } : {}) },
        });
      } else {
        // Fusion d'un compte invité portant le même e-mail (clerkId null), sinon création.
        const guest = await prisma.user.findFirst({
          where: { email, clerkId: null },
          select: { id: true },
        });
        if (guest && !emailVerified) {
          // Ne jamais rattacher les commandes d'un invité à un e-mail non prouvé.
          return new Response("Email not verified yet", { status: 409 });
        }
        if (guest) {
          await prisma.user.update({
            where: { id: guest.id },
            data: { ...profile, clerkId: u.id, isGuest: false, guestToken: null },
          });
        } else {
          await prisma.user.create({
            data: { ...profile, clerkId: u.id, role: metadataRole ?? Role.CLIENT },
          });
        }
      }
      await invalidateRoleCache(u.id);
    } else if (evt.type === "user.deleted" && evt.data.id) {
      await prisma.user.updateMany({
        where: { clerkId: evt.data.id },
        data: {
          email: `deleted_${evt.data.id}@deactivated.klikgo`,
          firstName: "Compte",
          lastName: "Supprimé",
          phone: null,
        },
      });
      await invalidateRoleCache(evt.data.id);
    }

    // 3. Marqueur APRÈS succès : un échec laisse Svix réessayer pour de bon.
    if (doneKey) await redis.set(doneKey, "1", { ex: 86400 });
    return Response.json({ received: true });
  } catch (error) {
    logger.error("[webhooks/clerk] processing failed", { type: evt.type, deliveryId, error });
    return new Response("Processing failed", { status: 500 });
  }
}
```

Points de vigilance : la fusion d'un invité n'a lieu que si l'e-mail principal est **vérifié**
(sinon s'inscrire avec l'e-mail d'autrui suffirait à récupérer ses commandes) ; le `409` fait
réessayer Svix, et l'événement `user.updated` émis après vérification rejouera la fusion. Le
contrôle d'ordre par `updated_at` (W5) n'est pas inclus : il demande une colonne supplémentaire.
Comme la route actuelle, ce modèle **recopie le rôle des metadata vers la base** à chaque
événement (W7) : il suppose que toute écriture de rôle passe par `setUserRole` (§ 7). Si le
propriétaire tranche pour « la base seule fait foi » (point à arbitrer n° 2), retirer
`role` du `update`. Secret absent : `verifyWebhook` lève, la route répond 401 (fermée par défaut).
Modèle compilé, **non exécuté** contre Svix ni contre une base.

## 7. Changer un rôle : une seule fonction

À extraire dans `src/lib/auth/` et à appeler depuis les routes qui écrivent un rôle aujourd'hui
chacune à leur façon (liste : [roles-et-synchronisation.md](roles-et-synchronisation.md) § 4).

```ts
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { invalidateRoleCache } from "@/lib/auth/role-cache";
import { writeAuditLog } from "@/lib/audit-log";
import type { Role } from "@prisma/client";

const METADATA_ROLE: Record<Role, string> = {
  CLIENT: "client",
  CLIENT_PRO: "client_pro",
  CLIENT_PRO_PENDING: "client_pro_pending",
  BOUCHER: "boucher",
  ADMIN: "admin",
};

export async function setUserRole(targetUserId: string, role: Role, actorClerkId: string) {
  const before = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, clerkId: true, role: true },
  });
  if (!before) return null;

  await prisma.user.update({ where: { id: before.id }, data: { role } });
  if (before.clerkId) {
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(before.clerkId, {
        publicMetadata: { role: METADATA_ROLE[role] },
      });
    } catch (error) {
      // Miroir non mis à jour : on ne laisse pas la base et Clerk en désaccord (le middleware,
      // requireAdmin et le webhook lisent les metadata). Retour à l'ancien rôle, puis erreur.
      await prisma.user.update({ where: { id: before.id }, data: { role: before.role } });
      throw error;
    }
    await invalidateRoleCache(before.clerkId);
  }
  await writeAuditLog({
    actorId: actorClerkId,
    action: "user.role.change",
    target: "user",
    targetId: before.id,
    details: { from: before.role, to: role },
  });
  return { id: before.id, clerkId: before.clerkId, role };
}
```

Pourquoi la compensation : si l'appel Clerk échoue après l'écriture en base (limite de 10 mises à
jour / 10 s par utilisateur, panne), une rétrogradation resterait sans effet réel — `requireAdmin`
et le middleware acceptent encore l'ancien rôle lu dans les metadata — et le prochain
`user.updated` réécrirait l'ancien rôle en base (W7). Aucune route actuelle ne gère ce cas.

## 8. Options de `clerkMiddleware` (ex. `authorizedParties` piloté par l'environnement)

Illustration de la signature `clerkMiddleware(handler, options)` ; à intégrer dans
`handleClerkAuth` de `src/middleware.ts` après arbitrage (point n° 3 du skill).

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const parties = (process.env.CLERK_AUTHORIZED_PARTIES ?? "").split(",").filter(Boolean);

export const handleClerkAuth = clerkMiddleware(
  async (auth, req) => {
    const { userId } = await auth();
    if (!userId && req.nextUrl.pathname.startsWith("/profil")) {
      await auth.protect();
    }
    return NextResponse.next();
  },
  parties.length > 0 ? { authorizedParties: parties } : {}
);
```

## 9. Logique de chemin sans `createRouteMatcher`

Pour toute **nouvelle** logique de chemin hors auth, et pour préparer la sortie de l'API dépréciée.

```ts
// Remplaçant de createRouteMatcher pour la logique de chemin (déprécié en @clerk/nextjs 7.5.14).
// Pur, testable, sans regex : « /boucher » ne correspond jamais à « /boucheries-halal ».
export function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const ADMIN_PREFIXES = ["/admin", "/webmaster"] as const;

export function isAdminArea(pathname: string): boolean {
  return pathname !== "/admin-login" && ADMIN_PREFIXES.some((p) => isUnder(pathname, p));
}
```

## Anti-patrons (tous rencontrés dans ce dépôt ou dans l'ancien skill)

```ts
// ❌ casse le mode test et lève hors matcher
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();

// ❌ rôle lu dans les metadata Clerk : périmé si le miroir n'a pas suivi
const role = (await currentUser())?.publicMetadata?.role;

// ❌ id Clerk comparé à une clé étrangère Prisma : ne correspond jamais
await prisma.order.findMany({ where: { userId: clerkId } });

// ❌ propriétaire cherché sur un seul format d'id
await prisma.shop.findFirst({ where: { ownerId: clerkId } });

// ❌ shopId accepté depuis le corps ou la query d'une route boucher
const { shopId } = await req.json();

// ❌ motif collé : attrape aussi /boucheries-halal…
createRouteMatcher(["/boucher(.*)"]);
```
