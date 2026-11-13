// @vitest-environment node
//
// Jeton de session du mode test. C'est ce qui remplace le cookie en clair
// « klikgo-test-activated=true » qui, jusqu'au 2026-11-13, donnait l'accès
// admin à quiconque le posait à la main. Tout assouplissement ici rouvre la
// faille : chaque propriété de sécurité est épinglée par un test.

import { describe, it, expect } from "vitest";
import {
  MIN_TEST_SECRET_LENGTH,
  TEST_SESSION_TTL_SECONDS,
  buildSigningInput,
  bytesToBase64Url,
  parseTestSession,
  signTestSession,
  verifyTestSession,
} from "@/lib/auth/test-session";
import {
  secretsMatch,
  signTestSessionSync,
  verifyTestSessionSync,
} from "@/lib/auth/test-session-node";

const SECRET = "un-secret-de-test-assez-long";
const OTHER_SECRET = "un-autre-secret-de-test-long";
const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

describe("jeton de session de test", () => {
  it("un jeton émis est accepté et rend son rôle (Node et Web Crypto)", async () => {
    for (const role of ["CLIENT", "BOUCHER", "ADMIN"] as const) {
      const token = signTestSessionSync(role, SECRET, NOW);
      expect(verifyTestSessionSync(token, SECRET, NOW)).toBe(role);
      expect(await verifyTestSession(token, SECRET, NOW)).toBe(role);
    }
  });

  it("les deux implémentations produisent et acceptent le même format", async () => {
    const fromNode = signTestSessionSync("BOUCHER", SECRET, NOW);
    const fromWeb = await signTestSession("BOUCHER", SECRET, NOW);
    expect(fromWeb).toBe(fromNode);
    expect(await verifyTestSession(fromNode, SECRET, NOW)).toBe("BOUCHER");
    expect(verifyTestSessionSync(fromWeb, SECRET, NOW)).toBe("BOUCHER");
  });

  it("refuse les anciennes valeurs en clair et tout ce qui n'est pas un jeton", async () => {
    for (const forged of ["true", "ADMIN", "", "v1.x.y", "a.b", "v1..", undefined, null]) {
      expect(verifyTestSessionSync(forged, SECRET, NOW)).toBeNull();
      expect(await verifyTestSession(forged, SECRET, NOW)).toBeNull();
    }
  });

  it("refuse un jeton signé avec un autre secret", async () => {
    const token = signTestSessionSync("ADMIN", OTHER_SECRET, NOW);
    expect(verifyTestSessionSync(token, SECRET, NOW)).toBeNull();
    expect(await verifyTestSession(token, SECRET, NOW)).toBeNull();
  });

  it("refuse un rôle modifié après signature (CLIENT → ADMIN)", async () => {
    const clientToken = signTestSessionSync("CLIENT", SECRET, NOW);
    const signature = clientToken.split(".")[2];
    const expiry = parseTestSession(clientToken)!.expiresAtSeconds;
    const forged = `${buildSigningInput("ADMIN", expiry)}.${signature}`;
    expect(parseTestSession(forged)?.role).toBe("ADMIN");
    expect(verifyTestSessionSync(forged, SECRET, NOW)).toBeNull();
    expect(await verifyTestSession(forged, SECRET, NOW)).toBeNull();
  });

  it("refuse une expiration repoussée après signature", () => {
    const token = signTestSessionSync("ADMIN", SECRET, NOW, 60);
    const signature = token.split(".")[2];
    const forged = `${buildSigningInput("ADMIN", Math.floor(NOW / 1000) + 10 * 365 * 86400)}.${signature}`;
    expect(verifyTestSessionSync(forged, SECRET, NOW)).toBeNull();
  });

  it("expire à l'échéance", async () => {
    const token = signTestSessionSync("ADMIN", SECRET, NOW);
    const justBefore = NOW + TEST_SESSION_TTL_SECONDS * 1000 - 1000;
    const atExpiry = NOW + TEST_SESSION_TTL_SECONDS * 1000;
    expect(verifyTestSessionSync(token, SECRET, justBefore)).toBe("ADMIN");
    expect(verifyTestSessionSync(token, SECRET, atExpiry)).toBeNull();
    expect(await verifyTestSession(token, SECRET, atExpiry)).toBeNull();
  });

  it("refuse une signature de mauvaise taille ou tronquée", () => {
    const token = signTestSessionSync("ADMIN", SECRET, NOW);
    const [version, payload, signature] = token.split(".");
    expect(verifyTestSessionSync(`${version}.${payload}.${signature.slice(0, -4)}`, SECRET, NOW)).toBeNull();
    expect(verifyTestSessionSync(`${version}.${payload}.${bytesToBase64Url(new Uint8Array(32))}`, SECRET, NOW)).toBeNull();
  });

  it("refuse tout quand le secret est absent ou trop court, à l'émission comme à la vérification", async () => {
    const short = "x".repeat(MIN_TEST_SECRET_LENGTH - 1);
    expect(() => signTestSessionSync("ADMIN", short, NOW)).toThrow();
    await expect(signTestSession("ADMIN", "", NOW)).rejects.toThrow();

    const token = signTestSessionSync("ADMIN", SECRET, NOW);
    for (const bad of ["", short, undefined, null]) {
      expect(verifyTestSessionSync(token, bad, NOW)).toBeNull();
      expect(await verifyTestSession(token, bad, NOW)).toBeNull();
    }
  });
});

describe("secretsMatch", () => {
  it("compare deux secrets sans dépendre de leur longueur", () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
    expect(secretsMatch(SECRET, OTHER_SECRET)).toBe(false);
    expect(secretsMatch("", SECRET)).toBe(false);
    expect(secretsMatch(SECRET + "x", SECRET)).toBe(false);
  });
});
