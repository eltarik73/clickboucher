// @security: test-only — Activation du mode test côté serveur.
//
// Après vérification du secret, pose un jeton de session SIGNÉ (cookie httpOnly,
// lié au rôle, expirant) : c'est la seule preuve que le serveur accepte ensuite.
// Deux cookies en clair servent d'indice à l'interface (badge « T », rôle affiché)
// et ne donnent aucun droit. Le secret n'est jamais exposé au client.
// Route inopérante sur le déploiement de production Vercel (isTestMode() = false).

import { NextRequest, NextResponse } from "next/server";
import { getTestSecret, isTestMode, type TestRole } from "@/lib/auth/test-auth";
import {
  TEST_HINT_COOKIE,
  TEST_ROLE_HINT_COOKIE,
  TEST_SESSION_COOKIE,
  TEST_SESSION_TTL_SECONDS,
  isUsableTestSecret,
  isValidTestRole,
} from "@/lib/auth/test-session";
import {
  secretsMatch,
  signTestSessionSync,
  verifyTestSessionSync,
} from "@/lib/auth/test-session-node";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function forbidden(message: string, status = 403) {
  return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message } }, { status });
}

function parseRole(value: unknown): TestRole {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return isValidTestRole(upper) ? upper : "CLIENT";
}

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Réponse de succès portant le jeton signé et les indices d'interface. */
function sessionResponse(role: TestRole, secret: string) {
  const res = NextResponse.json({ success: true, data: { activated: true, role } });
  const base = {
    path: "/",
    maxAge: TEST_SESSION_TTL_SECONDS,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.VERCEL === "1",
  };
  res.cookies.set(TEST_SESSION_COOKIE, signTestSessionSync(role, secret), { ...base, httpOnly: true });
  res.cookies.set(TEST_HINT_COOKIE, "true", { ...base, httpOnly: false });
  res.cookies.set(TEST_ROLE_HINT_COOKIE, role, { ...base, httpOnly: false });
  return res;
}

/** Vérifie le secret fourni et ouvre une session de test pour le rôle demandé. */
async function activate(req: NextRequest, provided: string, role: TestRole) {
  if (!isTestMode()) return forbidden("Test mode disabled");

  const secret = getTestSecret();
  if (!isUsableTestSecret(secret)) return forbidden("TEST_SECRET not configured");

  const limit = await checkRateLimit(rateLimits.otpVerify, `test-mode:${clientKey(req)}`);
  if (!limit.success) return forbidden("Too many attempts", 429);

  if (!secretsMatch(provided, secret)) return forbidden("Invalid secret");

  return sessionResponse(role, secret);
}

/**
 * GET /api/test-mode/activate?secret=...&role=CLIENT|BOUCHER|ADMIN
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return activate(req, url.searchParams.get("secret") || "", parseRole(url.searchParams.get("role")));
}

/**
 * POST /api/test-mode/activate — body: { secret: string, role?: TestRole }
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rec = (body ?? {}) as Record<string, unknown>;
  const provided = typeof rec.secret === "string" ? rec.secret : "";
  return activate(req, provided, parseRole(rec.role));
}

/**
 * PATCH /api/test-mode/activate — body: { role: TestRole }
 * Change de rôle : exige une session de test valide (donc déjà ouverte avec le
 * secret) et réémet un jeton signé pour le nouveau rôle.
 */
export async function PATCH(req: NextRequest) {
  if (!isTestMode()) return forbidden("Test mode disabled");

  const secret = getTestSecret();
  const current = verifyTestSessionSync(req.cookies.get(TEST_SESSION_COOKIE)?.value, secret);
  if (!current || !isUsableTestSecret(secret)) return forbidden("No active test session");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return sessionResponse(parseRole(((body ?? {}) as Record<string, unknown>).role), secret);
}

/**
 * DELETE /api/test-mode/activate — ferme la session de test.
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true, data: { activated: false } });
  for (const name of [TEST_SESSION_COOKIE, TEST_HINT_COOKIE, TEST_ROLE_HINT_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
