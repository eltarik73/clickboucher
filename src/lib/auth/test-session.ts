// src/lib/auth/test-session.ts — Jeton de session du mode test, signé (HMAC-SHA256).
//
// Le serveur ne fait confiance QU'À ce jeton, posé en cookie httpOnly par
// /api/test-mode/activate après vérification du secret. Il porte le rôle et une
// date d'expiration ; sans TEST_SECRET il est infalsifiable.
//
// Module sans import Node : utilisable dans le middleware (edge, Web Crypto).
// La variante synchrone pour les route handlers est dans test-session-node.ts.

import type { TestRole } from "./test-auth";

/** Cookie httpOnly portant le jeton signé — la seule preuve acceptée côté serveur. */
export const TEST_SESSION_COOKIE = "klikgo-test-session";
/** Indices d'interface, lisibles par le navigateur, JAMAIS utilisés pour autoriser. */
export const TEST_HINT_COOKIE = "klikgo-test-activated";
export const TEST_ROLE_HINT_COOKIE = "klikgo-test-role";

/** Durée de vie d'une session de test. */
export const TEST_SESSION_TTL_SECONDS = 8 * 60 * 60;
/** Un secret plus court est refusé : il serait devinable. */
export const MIN_TEST_SECRET_LENGTH = 16;

const TOKEN_VERSION = "v1";
const VALID_ROLES: readonly TestRole[] = ["CLIENT", "BOUCHER", "ADMIN"];

export function isValidTestRole(value: unknown): value is TestRole {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

export function isUsableTestSecret(secret: string | undefined | null): secret is string {
  return typeof secret === "string" && secret.length >= MIN_TEST_SECRET_LENGTH;
}

// ── base64url (btoa/atob existent en Node ≥ 18 et dans le runtime edge) ──

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// ── Format : v1.<payload base64url>.<signature base64url> ──

interface TestSessionPayload {
  /** rôle */
  r: TestRole;
  /** expiration, en secondes depuis l'époque Unix */
  e: number;
}

/** Partie signée d'un jeton pour un rôle et une expiration donnés. */
export function buildSigningInput(role: TestRole, expiresAtSeconds: number): string {
  const payload: TestSessionPayload = { r: role, e: expiresAtSeconds };
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${TOKEN_VERSION}.${encoded}`;
}

export interface ParsedTestSession {
  signingInput: string;
  signature: Uint8Array<ArrayBuffer>;
  role: TestRole;
  expiresAtSeconds: number;
}

/** Décode un jeton SANS vérifier sa signature. Renvoie null s'il est mal formé. */
export function parseTestSession(token: string | undefined | null): ParsedTestSession | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const payloadBytes = base64UrlToBytes(parts[1]);
  const signature = base64UrlToBytes(parts[2]);
  if (!payloadBytes || !signature || signature.length !== 32) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { r, e } = payload as Record<string, unknown>;
  if (!isValidTestRole(r) || typeof e !== "number" || !Number.isFinite(e)) return null;

  return { signingInput: `${parts[0]}.${parts[1]}`, signature, role: r, expiresAtSeconds: e };
}

function isExpired(expiresAtSeconds: number, nowMs: number): boolean {
  return expiresAtSeconds * 1000 <= nowMs;
}

async function importHmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

/** Émet un jeton signé (Web Crypto). */
export async function signTestSession(
  role: TestRole,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = TEST_SESSION_TTL_SECONDS
): Promise<string> {
  if (!isUsableTestSecret(secret)) throw new Error("TEST_SECRET absent ou trop court");
  const signingInput = buildSigningInput(role, Math.floor(nowMs / 1000) + ttlSeconds);
  const key = await importHmacKey(secret, "sign");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/**
 * Vérifie un jeton (Web Crypto, comparaison à temps constant) et renvoie son
 * rôle, ou null s'il est absent, mal formé, expiré ou mal signé.
 */
export async function verifyTestSession(
  token: string | undefined | null,
  secret: string | undefined | null,
  nowMs: number = Date.now()
): Promise<TestRole | null> {
  if (!isUsableTestSecret(secret)) return null;
  const parsed = parseTestSession(token);
  if (!parsed || isExpired(parsed.expiresAtSeconds, nowMs)) return null;
  const key = await importHmacKey(secret, "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    parsed.signature,
    new TextEncoder().encode(parsed.signingInput)
  );
  return valid ? parsed.role : null;
}

export { isExpired as isTestSessionExpired };
