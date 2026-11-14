import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIZES = ["default", "sm", "lg", "xl"] as const;
const VARIANTS = ["default", "destructive", "outline", "secondary", "ghost", "link", "success"] as const;
const FILLED_VARIANTS = VARIANTS.filter((v) => v !== "link" && v !== "ghost" && v !== "outline");

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

describe("Button : tailles", () => {
  it.each(SIZES)("la taille %s mesure au moins 44 px de haut", (size) => {
    const heights = classesOf(buttonVariants({ size })).filter((c) => /^h-\d+$/.test(c));
    expect(heights).toHaveLength(1);
    expect(Number(heights[0].slice(2)) * 4).toBeGreaterThanOrEqual(44);
  });

  it("la petite taille n'utilise plus rounded-lg", () => {
    const classes = classesOf(cn(buttonVariants({ size: "sm" })));
    expect(classes).not.toContain("rounded-lg");
    expect(classes).toContain("rounded-control");
  });
});

describe("Button : couleurs", () => {
  it.each(FILLED_VARIANTS.flatMap((variant) => SIZES.map((size) => [variant, size] as const)))(
    "la variante %s en taille %s garde sa couleur de texte",
    (variant, size) => {
      const classes = classesOf(cn(buttonVariants({ variant, size })));
      expect(classes.some((c) => /^text-[a-z-]+-foreground$/.test(c))).toBe(true);
    },
  );

  it("le survol de la variante par défaut fonce avec primary-hover", () => {
    expect(classesOf(buttonVariants({ variant: "default" }))).toContain("hover:bg-primary-hover");
  });

  it.each(VARIANTS)("la variante %s ne s'éclaircit pas au survol", (variant) => {
    expect(buttonVariants({ variant })).not.toContain("/90");
    expect(buttonVariants({ variant })).not.toContain("/80");
  });

  it("aucune transition-all ni outline-none seul", () => {
    const classes = classesOf(buttonVariants());
    expect(classes).not.toContain("transition-all");
    expect(classes).not.toContain("outline-none");
    expect(classes).toContain("focus-visible:outline-none");
    expect(classes).toContain("focus-visible:ring-2");
  });
});

describe("Button : comportement", () => {
  it("loading désactive le bouton, l'annonce occupé et garde le libellé", () => {
    render(<Button loading>Confirmer ma commande</Button>);
    const button = screen.getByRole("button", { name: "Confirmer ma commande" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    const svg = button.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("sans loading, ni aria-busy ni spinner", () => {
    render(<Button>Ajouter</Button>);
    const button = screen.getByRole("button", { name: "Ajouter" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toBeEnabled();
    expect(button.querySelector("svg")).toBeNull();
  });

  it("garde un aria-busy passé par l'appelant quand loading est faux", () => {
    render(<Button aria-busy="true">Envoi</Button>);
    const button = screen.getByRole("button", { name: "Envoi" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeEnabled();
  });

  it("asChild rend l'enfant avec les classes du bouton", () => {
    const { container } = render(
      <Button asChild size="lg">
        <a href="/panier">Voir le panier</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Voir le panier" });
    expect(link).toHaveClass("h-14", "bg-primary", "text-primary-foreground");
    expect(container.querySelector("button")).toBeNull();
  });

  it("refuse les variantes et tailles supprimées et asChild avec loading", () => {
    // @ts-expect-error la variante premium n'existe plus
    const premium = <Button variant="premium">x</Button>;
    // @ts-expect-error la taille icon n'existe plus : IconButton est le seul bouton icône
    const icon = <Button size="icon">x</Button>;
    const both = (
      // @ts-expect-error asChild et loading sont exclusifs
      <Button asChild loading>
        <a href="/">x</a>
      </Button>
    );
    expect([premium, icon, both]).toHaveLength(3);
  });
});
