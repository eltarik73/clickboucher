import type { AppRole } from "@/types";

// RBAC simple basé sur Clerk Organizations + roles
// Roles attendus dans Clerk Org:
//   org:admin       → WEBMASTER
//   org:manager     → BUTCHER
//   (pas d'org)     → CLIENT

export function roleFromClerk(orgRole?: string | null): AppRole {
  if (!orgRole) return "CLIENT";
  if (orgRole === "org:admin") return "WEBMASTER";
  if (orgRole === "org:manager" || orgRole === "org:admin_butcher") return "BUTCHER";
  return "CLIENT";
}
