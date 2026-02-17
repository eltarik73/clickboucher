// src/lib/admin-auth.ts — Admin authentication helper
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api/errors";

/**
 * Vérifie que l'utilisateur est admin (via Clerk metadata + DB role).
 * Retourne l'userId ou une réponse 401/403.
 */
export async function requireAdmin() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return { error: apiError("UNAUTHORIZED", "Authentification requise") };
  }

  // Check Clerk metadata first (fast)
  const role = (sessionClaims?.metadata as Record<string, string>)?.role;
  if (role === "admin") {
    return { userId };
  }

  // Fallback: check DB role
  const user = await prisma.user.findFirst({
    where: { clerkId: userId, role: "ADMIN" },
    select: { id: true },
  });

  if (!user) {
    return { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };
  }

  return { userId };
}
