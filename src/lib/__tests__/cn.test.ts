// @vitest-environment node
import { describe, expect, it } from "vitest";
import resolveConfig from "tailwindcss/resolveConfig";
import { cn } from "@/lib/utils";
import { FONT_SIZE_SCALE, RADIUS_SCALE, SHADOW_SCALE } from "@/lib/design-tokens";
import { buttonVariants } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

const FONT_SIZE_CLASS =
  /^text-(xs|sm|base|lg|[2-9]?xl|hero|title|subtitle|body-lg|body|caption|micro)$/;

describe("cn() connaît les noms d'échelle du thème", () => {
  it("garde une taille projet et une couleur de texte côte à côte", () => {
    expect(classesOf(cn("text-body", "text-primary-foreground"))).toEqual([
      "text-body",
      "text-primary-foreground",
    ]);
    expect(classesOf(cn("text-body text-primary-foreground"))).toEqual([
      "text-body",
      "text-primary-foreground",
    ]);
  });

  it.each(Object.keys(FONT_SIZE_SCALE))("text-%s est une taille, pas une couleur", (key) => {
    expect(classesOf(cn(`text-${key}`, "text-foreground"))).toEqual([
      `text-${key}`,
      "text-foreground",
    ]);
    expect(classesOf(cn(`text-${key}`, "text-sm"))).toEqual(["text-sm"]);
  });

  it.each(Object.keys(SHADOW_SCALE))("shadow-%s remplace une autre ombre", (key) => {
    expect(classesOf(cn("shadow-sm", `shadow-${key}`))).toEqual([`shadow-${key}`]);
  });

  it.each(Object.keys(RADIUS_SCALE))("rounded-%s remplace un autre rayon", (key) => {
    expect(classesOf(cn("rounded-xl", `rounded-${key}`))).toEqual([`rounded-${key}`]);
  });
});

describe("les primitives gardent leur couleur et leur taille de texte", () => {
  it.each(["sm", "lg", "xl"] as const)("Button size %s garde le texte blanc et une seule taille", (size) => {
    const classes = classesOf(cn(buttonVariants({ size })));
    expect(classes).toContain("text-primary-foreground");
    expect(classes.filter((c) => FONT_SIZE_CLASS.test(c))).toHaveLength(1);
  });

  it.each(["default", "secondary", "destructive", "outline", "success", "warning", "pro"] as const)(
    "Badge %s garde text-micro",
    (variant) => {
      expect(classesOf(cn(badgeVariants({ variant })))).toContain("text-micro");
    },
  );
});

describe("le thème Tailwind et tailwind-merge lisent les mêmes échelles", () => {
  it("fontSize et boxShadow du thème ont exactement les clés des échelles", async () => {
    const { default: config } = await import("../../../tailwind.config");
    const extend = config.theme?.extend ?? {};
    expect(Object.keys(extend.fontSize ?? {}).sort()).toEqual(Object.keys(FONT_SIZE_SCALE).sort());
    expect(Object.keys(extend.boxShadow ?? {}).sort()).toEqual(Object.keys(SHADOW_SCALE).sort());

    const theme = resolveConfig(config).theme;
    for (const key of Object.keys(FONT_SIZE_SCALE)) expect(theme.fontSize).toHaveProperty(key);
    for (const key of Object.keys(SHADOW_SCALE)) expect(theme.boxShadow).toHaveProperty(key);
    for (const key of Object.keys(RADIUS_SCALE)) expect(theme.borderRadius).toHaveProperty(key);
  });
});
