// src/lib/admin-auth.ts — Admin authentication helper
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";

/**
 * Vérifie que l'utilisateur est admin (via Clerk publicMetadata + DB role).
 * Retourne l'userId ou une réponse 401/403.
 */
export async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return { error: apiError("UNAUTHORIZED", "Authentification requise") };
  }

  // Read role directly from Clerk publicMetadata (not sessionClaims)
  const user = await currentUser();
  const role = (user?.publicMetadata as Record<string, string>)?.role;
  if (isAdmin(role)) {
    return { userId };
  }

  // Fallback: check DB role
  const dbUser = await prisma.user.findFirst({
    where: { clerkId: userId, role: "ADMIN" },
    select: { id: true },
  });

  if (!dbUser) {
    return { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };
  }

  return { userId };
}
