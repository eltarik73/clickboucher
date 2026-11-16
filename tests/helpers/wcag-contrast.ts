// tests/helpers/wcag-contrast.ts — WCAG 2.2 contrast ratio of two opaque sRGB colours, shared by
// the token matrix (src/lib/__tests__/design-tokens-contrast.test.ts) and the browser checks.

/** sRGB channels from 0 to 255; a fourth channel (alpha) is ignored. */
export type Rgb = readonly [number, number, number, ...number[]];

function relativeLuminance([r, g, b]: Rgb): number {
  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
