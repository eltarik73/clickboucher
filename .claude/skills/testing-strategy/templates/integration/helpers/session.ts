// Destination : tests/integration/helpers/session.ts
// Identité lue par le faux Clerk de tests/integration/setup/clerk-mock.ts.
// Module ordinaire (pas de vi.hoisted) : la fabrique de vi.mock le lit par import dynamique.
const state = { clerkId: null as string | null };

export const currentClerkId = (): string | null => state.clerkId;

/**
 * Les handlers appelés ensuite voient cet utilisateur comme connecté.
 * Passer la ligne User créée par une fabrique : seul son clerkId est lu.
 * Un invité (clerkId null) reste non connecté, comme en production.
 */
export function signInAs(user: { clerkId: string | null }): void {
  state.clerkId = user.clerkId;
}

export function signOut(): void {
  state.clerkId = null;
}
