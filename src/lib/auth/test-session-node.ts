// src/lib/auth/test-session-node.ts — Vérification SYNCHRONE du jeton de test (runtime Node).
//
// Les helpers d'auth (server-auth, admin-auth, boucher-auth) sont synchrones :
// ils utilisent node:crypto. Le middleware (edge) utilise la variante Web Crypto
// de test-session.ts. Les deux partagent le même format et sont testées l'une
// contre l'autre (src/lib/__tests__/test-session.test.ts).

import { createHmac, timingSafeEqual } from "node:crypto";
import type { TestRole } from "./test-auth";
import {
  TEST_SESSION_TTL_SECONDS,
  buildSigningInput,
  bytesToBase64Url,
  isTestSessionExpired,
  isUsableTestSecret,
  parseTestSession,
} from "./test-session";

function hmac(secret: string, input: string): Buffer {
  return createHmac("sha256", secret).update(input).digest();
}

/** Émet un jeton signé (node:crypto). */
export function signTestSessionSync(
  role: TestRole,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = TEST_SESSION_TTL_SECONDS
): string {
  if (!isUsableTestSecret(secret)) throw new Error("TEST_SECRET absent ou trop court");
  const signingInput = buildSigningInput(role, Math.floor(nowMs / 1000) + ttlSeconds);
  return `${signingInput}.${bytesToBase64Url(hmac(secret, signingInput))}`;
}

/** Vérifie un jeton et renvoie son rôle, ou null (absent, mal formé, expiré, mal signé). */
export function verifyTestSessionSync(
  token: string | undefined | null,
  secret: string | undefined | null,
  nowMs: number = Date.now()
): TestRole | null {
  if (!isUsableTestSecret(secret)) return null;
  const parsed = parseTestSession(token);
  if (!parsed || isTestSessionExpired(parsed.expiresAtSeconds, nowMs)) return null;
  const expected = hmac(secret, parsed.signingInput);
  const provided = Buffer.from(parsed.signature);
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? parsed.role : null;
}

/** Comparaison à temps constant de deux secrets (via leurs empreintes, longueurs masquées). */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHmac("sha256", "klikgo-test-secret-compare").update(provided).digest();
  const b = createHmac("sha256", "klikgo-test-secret-compare").update(expected).digest();
  return timingSafeEqual(a, b);
}
