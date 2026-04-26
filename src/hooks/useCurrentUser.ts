"use client";
// @security: test-only — Wrapper pour useUser de Clerk avec bypass test mode

import { useUser } from "@clerk/nextjs";
import { useTestAuth } from "@/hooks/useTestAuth";

/**
 * Wrapper autour de useUser() de Clerk.
 * En mode test (activé via secret), retourne un mock user basé sur le rôle sélectionné.
 * En production ou si non-activé, délègue à Clerk normalement.
 */
export function useCurrentUser() {
  // @security: test-only — must always call hooks unconditionally
  const testAuth = useTestAuth();
  const clerkAuth = useUser();

  if (testAuth.enabled && testAuth.activated) {
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: testAuth.user.id,
        firstName: testAuth.user.firstName,
        lastName: testAuth.user.lastName,
        emailAddresses: [{ emailAddress: testAuth.user.email }],
        publicMetadata: { role: testAuth.user.role.toLowerCase() },
        imageUrl: null,
      },
      role: testAuth.role,
      clerkId: testAuth.user.clerkId,
    };
  }

  // Mode normal : Clerk
  const role = ((clerkAuth.user?.publicMetadata?.role as string) || "client").toUpperCase();

  return {
    isLoaded: clerkAuth.isLoaded,
    isSignedIn: clerkAuth.isSignedIn || false,
    user: clerkAuth.user as typeof clerkAuth.user | null,
    role,
    clerkId: clerkAuth.user?.id || null,
  };
}
