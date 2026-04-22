// tests/lib/image-prompts.test.ts — Prompt builder coverage
import { describe, it, expect } from "vitest";
import {
  buildGenPrompt,
  buildRetouchPrompt,
  GEN_PRESETS,
  BACKGROUNDS,
  ANGLES,
  RETOUCH_PRESETS,
} from "@/lib/image-prompts";

describe("buildGenPrompt", () => {
  it("includes translated user prompt, preset, background, angle, base suffix", () => {
    const out = buildGenPrompt({
      userPrompt: "côte de bœuf marbrée",
      preset: "COTE",
      background: "WOOD",
      angle: "45",
    });
    expect(out).toMatch(/rib/i); // FR→EN côte → rib
    expect(out).toMatch(/beef/i); // bœuf → beef
    expect(out).toMatch(/prime rib/i); // COTE preset keyword
    expect(out).toMatch(/wooden butcher board/i); // WOOD background
    expect(out).toMatch(/45-degree/); // 45 angle
    expect(out).toMatch(/halal certified/); // base suffix
  });

  it("omits preset keywords when preset=NONE", () => {
    const out = buildGenPrompt({
      userPrompt: "steak",
      preset: "NONE",
      background: "WHITE",
      angle: "FRONT",
    });
    expect(out).not.toMatch(/prime rib|merguez|brochette/i);
  });

  it("handles every combination without throwing", () => {
    for (const p of GEN_PRESETS) {
      for (const bg of BACKGROUNDS) {
        for (const a of ANGLES) {
          const out = buildGenPrompt({
            userPrompt: "test",
            preset: p,
            background: bg,
            angle: a,
          });
          expect(typeof out).toBe("string");
          expect(out.length).toBeGreaterThan(20);
        }
      }
    }
  });
});

describe("buildRetouchPrompt", () => {
  it("includes preset keywords and base suffix", () => {
    const out = buildRetouchPrompt({ preset: "CLEAN_BACKGROUND" });
    expect(out).toMatch(/white studio backdrop/i);
    expect(out).toMatch(/preserve the meat/i);
    expect(out).toMatch(/butcher product photography/);
  });

  it("appends custom prompt when provided", () => {
    const out = buildRetouchPrompt({
      preset: "APPETIZING",
      customPrompt: "add green parsley garnish",
    });
    expect(out).toMatch(/golden hour/i);
    expect(out).toMatch(/parsley garnish/);
  });

  it("handles every retouch preset", () => {
    for (const preset of RETOUCH_PRESETS) {
      const out = buildRetouchPrompt({ preset });
      expect(out.length).toBeGreaterThan(20);
    }
  });

  it("ignores empty customPrompt", () => {
    const out = buildRetouchPrompt({
      preset: "STUDIO_LIGHT",
      customPrompt: "   ",
    });
    expect(out).not.toMatch(/,\s*,/); // no double comma
  });
});
