// @vitest-environment node
// The per-order access credential (C1-INVITES): format, hash, constant-time match, expiry, paths
// and cookie. Pure functions, no database.
import { describe, expect, it, vi } from "vitest";
import {
  credentialMatches,
  generateOrderCredential,
  hashOrderCredential,
  isCredentialShaped,
  orderAccessCookieName,
  orderAccessPath,
  orderCredentialExpiresAt,
  orderPagePath,
  setOrderAccessCookie,
  type ResponseCookieJar,
} from "@/lib/auth/order-credential";

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

describe("generateOrderCredential", () => {
  it("draws 43 base64url characters that decode to 32 bytes, stored only as their hash", () => {
    const { token, tokenHash } = generateOrderCredential();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(tokenHash).toBe(hashOrderCredential(token));
    expect(tokenHash).not.toContain(token);
  });

  it("never draws the same token twice in 1000 draws", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateOrderCredential().token));
    expect(tokens.size).toBe(1000);
  });
});

describe("hashOrderCredential", () => {
  it("is the lowercase hex SHA-256 of the UTF-8 token (NIST test vector)", () => {
    expect(hashOrderCredential("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("credentialMatches", () => {
  const own = generateOrderCredential();

  it("accepts the token whose hash is stored", () => {
    expect(credentialMatches(own.token, own.tokenHash)).toBe(true);
  });

  it.each([
    ["another token", generateOrderCredential().token],
    ["a token with a space", "a b"],
    ["an empty string", ""],
    ["a 200-character string", "a".repeat(200)],
  ])("refuses %s", (_label, token) => {
    expect(credentialMatches(token, own.tokenHash)).toBe(false);
  });

  it.each([
    ["an uppercase hash", own.tokenHash.toUpperCase()],
    ["a truncated hash", own.tokenHash.slice(0, 63)],
    ["a hash that is not hex", "z".repeat(64)],
    ["an empty hash", ""],
  ])("refuses %s as the stored value", (_label, storedHash) => {
    expect(credentialMatches(own.token, storedHash)).toBe(false);
  });
});

describe("isCredentialShaped", () => {
  it("accepts a generated token and a legacy UUID token", () => {
    expect(isCredentialShaped(generateOrderCredential().token)).toBe(true);
    expect(isCredentialShaped("3b241101-e2bb-4255-8caf-4136c566a962")).toBe(true);
  });

  it.each([
    ["15 characters", "a".repeat(15)],
    ["129 characters", "a".repeat(129)],
    ["a slash", "abcdefghijklmnop/"],
    ["a dot", "abcdefghijklmnop."],
    ["a percent sign", "abcdefghijklmnop%2F"],
  ])("refuses %s", (_label, value) => {
    expect(isCredentialShaped(value)).toBe(false);
  });
});

describe("orderCredentialExpiresAt", () => {
  const createdAt = at("2026-11-01T10:00:00.000Z");

  it("counts 30 days from pickup when the order was picked up, whatever its slot", () => {
    const pickedUpAt = at("2026-11-02T18:30:00.000Z");
    const expiry = orderCredentialExpiresAt({
      createdAt,
      pickupSlotEnd: at("2026-11-05T12:00:00.000Z"),
      pickedUpAt,
    });
    expect(expiry.getTime() - pickedUpAt.getTime()).toBe(30 * DAY_MS);
  });

  it("counts 30 days from the end of a pickup slot later than the order", () => {
    const pickupSlotEnd = at("2026-11-04T12:00:00.000Z");
    const expiry = orderCredentialExpiresAt({ createdAt, pickupSlotEnd, pickedUpAt: null });
    expect(expiry.getTime() - pickupSlotEnd.getTime()).toBe(30 * DAY_MS);
  });

  it("counts 30 days from the order without a slot, or with a slot that ended before it", () => {
    for (const pickupSlotEnd of [null, at("2026-10-31T12:00:00.000Z")]) {
      const expiry = orderCredentialExpiresAt({ createdAt, pickupSlotEnd, pickedUpAt: null });
      expect(expiry.getTime() - createdAt.getTime()).toBe(30 * DAY_MS);
    }
  });
});

describe("order paths", () => {
  it("put the order id and the token in path segments, never in a query string", () => {
    const token = generateOrderCredential().token;
    expect(orderPagePath("cm123")).toBe("/suivi/cm123");
    expect(orderAccessPath("cm123", token)).toBe(`/suivi/cm123/acces/${token}`);
    expect(orderPagePath("cm123")).not.toContain("?");
    expect(orderAccessPath("cm123", token)).not.toContain("?");
  });

  it("encode each segment", () => {
    expect(orderPagePath("a/b?c")).toBe("/suivi/a%2Fb%3Fc");
    expect(orderAccessPath("a/b", "t?x=1")).toBe("/suivi/a%2Fb/acces/t%3Fx%3D1");
    expect(orderAccessPath("a/b", "t?x=1")).not.toContain("?");
  });
});

describe("setOrderAccessCookie", () => {
  it("sets the order's httpOnly cookie, Lax, on every path, expiring with the credential", () => {
    const set = vi.fn<ResponseCookieJar["set"]>();
    const order = {
      id: "cm123",
      createdAt: at("2026-11-01T10:00:00.000Z"),
      pickupSlotEnd: null,
      pickedUpAt: at("2026-11-01T17:00:00.000Z"),
    };
    setOrderAccessCookie({ set }, order, "the-token-value-123");

    expect(orderAccessCookieName("cm123")).toBe("klikgo-order-cm123");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("klikgo-order-cm123", "the-token-value-123", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: orderCredentialExpiresAt(order),
    });
  });
});
