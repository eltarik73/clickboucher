"use client";
// @security: test-only — Wrapper pour useUser de Clerk avec bypass test mode

import { useUser } from "@clerk/nextjs";
import { useTestAuth } from "@/hooks/useTestAuth";

/**
 * Wrapper autour de useUser() de Clerk.
 * En mode test, retourne un mock user basé sur le rôle sélectionné.
 * En production, délègue à Clerk normalement.
 */
export function useCurrentUser() {
  // @security: test-only
  if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user, role } = useTestAuth();
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddresses: [{ emailAddress: user.email }],
        publicMetadata: { role: user.role.toLowerCase() },
        imageUrl: null,
      },
      role: role,
      clerkId: user.clerkId,
    };
  }

  // Mode normal : Clerk
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isLoaded, isSignedIn, user } = useUser();
  const role = ((user?.publicMetadata?.role as string) || "client").toUpperCase();

  return {
    isLoaded,
    isSignedIn: isSignedIn || false,
    user: user as typeof user | null,
    role,
    clerkId: user?.id || null,
  };
}
