// src/lib/roles.ts — Centralized role helpers
// Accepts both "admin" and "webmaster" as admin roles (Clerk publicMetadata)

const ADMIN_ROLES = ["admin", "webmaster"];

export function isAdmin(role: string | undefined | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return ADMIN_ROLES.includes(lower);
}

export function isBoucher(role: string | undefined | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower === "boucher" || isAdmin(role);
}

/**
 * Extract role from Clerk sessionClaims.
 * Requires Clerk session token to be customized:
 *   { "metadata": "{{user.public_metadata}}" }
 */
export function getRoleFromClaims(
  sessionClaims: Record<string, unknown> | null | undefined
): string | undefined {
  return (sessionClaims?.metadata as Record<string, string> | undefined)?.role;
}
