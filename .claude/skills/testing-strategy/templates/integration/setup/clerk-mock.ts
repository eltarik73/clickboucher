// Destination : tests/integration/setup/clerk-mock.ts
// À ajouter aux `setupFiles` du projet Vitest `integration`, APRÈS ./tests/integration/setup/env.ts.
//
// Seule frontière simulée côté identité : la session Clerk. server-auth, boucher-auth, admin-auth et
// get-or-create-user tournent pour de vrai, sur la base : c'est là que vit la règle d'accès.
// Les transports (e-mail, push, WhatsApp) restent simulés dans chaque fichier de test, comme aujourd'hui.
// Un fichier qui simule encore @/lib/boucher-auth garde sa simulation : celle-ci ne le gêne pas.
// Vérifié le 2026-11-14 sur l'arbre du chantier 0 (references/integration-postgres.md §3, [L20]).
import { beforeEach, vi } from "vitest";
import { signOut } from "../helpers/session";

vi.mock("@clerk/nextjs/server", async () => {
  const { currentClerkId } = await import("../helpers/session");
  return {
    auth: vi.fn(async () => ({ userId: currentClerkId() })),
    currentUser: vi.fn(async () => null),
    clerkClient: vi.fn(async () => {
      throw new Error(
        "clerkClient ne doit pas être appelé en test d'intégration : créer l'utilisateur avec createTestUser().",
      );
    }),
  };
});

beforeEach(() => {
  signOut();
});
