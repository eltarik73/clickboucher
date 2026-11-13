// @vitest-environment node
import { describe, it, expect } from "vitest";
import { cookieStringHasTestMode, hasTestModeCookie, urlHasTestModeParam } from "@/lib/test-mode-client";

describe("cookieStringHasTestMode", () => {
  it("détecte le cookie d'activation, quelle que soit sa position", () => {
    expect(cookieStringHasTestMode("klikgo-test-activated=true")).toBe(true);
    expect(cookieStringHasTestMode("a=1; klikgo-test-activated=true")).toBe(true);
    expect(cookieStringHasTestMode("klikgo-test-activated=true; klikgo-test-role=BOUCHER")).toBe(true);
    expect(cookieStringHasTestMode("a=1;klikgo-test-activated=true;b=2")).toBe(true);
  });

  it("ignore les valeurs et noms approchants", () => {
    expect(cookieStringHasTestMode("")).toBe(false);
    expect(cookieStringHasTestMode("klikgo-test-activated=false")).toBe(false);
    expect(cookieStringHasTestMode("klikgo-test-activated=truthy")).toBe(false);
    expect(cookieStringHasTestMode("xklikgo-test-activated=true")).toBe(false);
    expect(cookieStringHasTestMode("klikgo-test-role=ADMIN")).toBe(false);
  });
});

describe("helpers navigateur hors navigateur", () => {
  it("renvoient false côté serveur (pas de document / window)", () => {
    expect(hasTestModeCookie()).toBe(false);
    expect(urlHasTestModeParam()).toBe(false);
  });
});
