// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  SAFE_IMAGE_CONTENT_TYPES,
  extensionForImageContentType,
  parseSafeImageContentType,
} from "@/lib/image-content-type";

describe("parseSafeImageContentType", () => {
  it("accepte les types image de la liste blanche", () => {
    expect(parseSafeImageContentType("image/jpeg")).toBe("image/jpeg");
    expect(parseSafeImageContentType("image/png")).toBe("image/png");
    expect(parseSafeImageContentType("image/webp")).toBe("image/webp");
    expect(parseSafeImageContentType("image/gif")).toBe("image/gif");
    expect(parseSafeImageContentType("image/avif")).toBe("image/avif");
  });

  it("normalise la casse, les espaces et les paramètres après ';'", () => {
    expect(parseSafeImageContentType("IMAGE/JPEG")).toBe("image/jpeg");
    expect(parseSafeImageContentType("  image/png  ")).toBe("image/png");
    expect(parseSafeImageContentType("image/webp; charset=binary")).toBe("image/webp");
    expect(parseSafeImageContentType("Image/Avif ;q=1")).toBe("image/avif");
  });

  it("refuse SVG, HTML et tout type hors liste", () => {
    expect(parseSafeImageContentType("image/svg+xml")).toBeNull();
    expect(parseSafeImageContentType("image/svg+xml; charset=utf-8")).toBeNull();
    expect(parseSafeImageContentType("text/html")).toBeNull();
    expect(parseSafeImageContentType("text/html; charset=utf-8")).toBeNull();
    expect(parseSafeImageContentType("application/octet-stream")).toBeNull();
    expect(parseSafeImageContentType("application/pdf")).toBeNull();
    expect(parseSafeImageContentType("image/heic")).toBeNull();
    expect(parseSafeImageContentType("image/jpg")).toBeNull();
  });

  it("ne se laisse pas tromper par un type sûr placé en paramètre ou en préfixe", () => {
    expect(parseSafeImageContentType("text/html; image/png")).toBeNull();
    expect(parseSafeImageContentType("text/html;image/jpeg")).toBeNull();
    expect(parseSafeImageContentType("image/pngx")).toBeNull();
    expect(parseSafeImageContentType("ximage/png")).toBeNull();
    expect(parseSafeImageContentType("image/png, text/html")).toBeNull();
  });

  it("retourne null sans en-tête (pas de valeur par défaut)", () => {
    expect(parseSafeImageContentType(null)).toBeNull();
    expect(parseSafeImageContentType(undefined)).toBeNull();
    expect(parseSafeImageContentType("")).toBeNull();
    expect(parseSafeImageContentType("   ")).toBeNull();
    expect(parseSafeImageContentType(";")).toBeNull();
  });
});

describe("extensionForImageContentType", () => {
  it("associe une extension à chaque type de la liste blanche", () => {
    expect(extensionForImageContentType("image/jpeg")).toBe("jpg");
    expect(extensionForImageContentType("image/png")).toBe("png");
    expect(extensionForImageContentType("image/webp")).toBe("webp");
    expect(extensionForImageContentType("image/gif")).toBe("gif");
    expect(extensionForImageContentType("image/avif")).toBe("avif");
  });

  it("couvre toute la liste blanche avec une extension alphanumérique", () => {
    for (const type of SAFE_IMAGE_CONTENT_TYPES) {
      expect(extensionForImageContentType(type)).toMatch(/^[a-z0-9]+$/);
    }
  });
});
