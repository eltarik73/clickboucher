import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button : tailles", () => {
  // h-N is N × 4 px: 44 px is h-11.
  it.each(["default", "sm", "lg", "xl"] as const)(
    "la taille %s mesure au moins 44 px de haut",
    (size) => {
      const heights = buttonVariants({ size })
        .split(/\s+/)
        .filter((name) => /^h-\d+$/.test(name));
      expect(heights).toHaveLength(1);
      expect(Number(heights[0].slice(2)) * 4).toBeGreaterThanOrEqual(44);
    }
  );
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
    render(
      <>
        <Button size="lg">Commander</Button>
        <Button asChild size="lg">
          <a href="/panier">Voir le panier</a>
        </Button>
      </>
    );
    const button = screen.getByRole("button", { name: "Commander" });
    const link = screen.getByRole("link", { name: "Voir le panier" });
    expect(screen.getAllByRole("button")).toEqual([button]);
    expect(link.className).toBe(button.className);
  });
});
