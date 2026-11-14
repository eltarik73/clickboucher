// Destination : src/lib/api/route-auth.ts (copie à l'identique).
// Fabriques authentifiées. Chacune délègue à un helper existant (test mode compris) :
// ne jamais appeler auth() de Clerk dans un handler (CLAUDE.md § Authentification API).
//
// ⚠️ Tout handler qui importe ce fichier doit être couvert par config.matcher de
// src/middleware.ts. Crons, webhooks, health, geo : importer route-open.ts à la place.
import type { Role } from "@prisma/client";

import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api/errors";
import { getServerUserId } from "@/lib/auth/server-auth";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { createRoute } from "@/lib/api/route-core";

/** `clerkId` = identifiant Clerk (`user_…`). Ne JAMAIS le comparer à une colonne `userId` Prisma. */
export type UserAuth = { clerkId: string };
export type OptionalUserAuth = { clerkId: string | null };
/** `userId` = identifiant Prisma (`User.id`) : c'est lui que portent Order.userId, LoyaltyReward.userId… */
export type ClientAuth = { clerkId: string; userId: string; role: Role };
/** `userId` = identifiant Prisma du boucher ; `shopId` = boutique à utiliser dans TOUTE requête Prisma. */
export type BoucherAuth = { userId: string; shopId: string };
/** `clerkId` = identifiant Clerk de l'admin (c'est ce que renvoie `requireAdmin().userId`). */
export type AdminAuth = { clerkId: string };

const unauthorized = () => apiError("UNAUTHORIZED", "Authentification requise");

/** Session requise, sans lecture en base. `ctx.auth.clerkId`. */
export const userRoute = createRoute<UserAuth>({
  authenticate: async () => {
    const clerkId = await getServerUserId();
    return clerkId ? { ok: true, auth: { clerkId } } : { ok: false, response: unauthorized() };
  },
  principal: (auth) => auth.clerkId,
  personalized: true,
});

/** Session facultative (prix pro, panier anonyme…). La réponse n'est jamais mise en cache partagé. */
export const optionalUserRoute = createRoute<OptionalUserAuth>({
  authenticate: async () => ({ ok: true, auth: { clerkId: await getServerUserId() } }),
  principal: (auth) => auth.clerkId,
  personalized: true,
});

/**
 * Session requise + utilisateur Prisma résolu : `ctx.auth.userId` est l'id Prisma à comparer aux
 * colonnes `userId` (CLAUDE.md § Résolution userId). Crée la ligne si le webhook Clerk a du retard.
 */
export const clientRoute = createRoute<ClientAuth>({
  authenticate: async () => {
    const clerkId = await getServerUserId();
    if (!clerkId) return { ok: false, response: unauthorized() };
    const user =
      (await prisma.user.findUnique({ where: { clerkId }, select: { id: true, role: true } })) ??
      (await getOrCreateUser(clerkId));
    if (!user) return { ok: false, response: apiError("NOT_FOUND", "Utilisateur introuvable") };
    return { ok: true, auth: { clerkId, userId: user.id, role: user.role } };
  },
  principal: (auth) => auth.userId,
  personalized: true,
});

/** Boucher (ou admin) propriétaire d'une boutique. `ctx.auth.shopId` borne toutes les requêtes. */
export const boucherRoute = createRoute<BoucherAuth>({
  authenticate: async () => {
    const result = await getAuthenticatedBoucher();
    if (result.error) return { ok: false, response: result.error };
    return { ok: true, auth: { userId: result.userId, shopId: result.shopId } };
  },
  principal: (auth) => auth.shopId,
  personalized: true,
});

/** Administrateur / webmaster. */
export const adminRoute = createRoute<AdminAuth>({
  authenticate: async () => {
    const result = await requireAdmin();
    if (result.error) return { ok: false, response: result.error };
    return { ok: true, auth: { clerkId: result.userId } };
  },
  principal: (auth) => auth.clerkId,
  personalized: true,
});
