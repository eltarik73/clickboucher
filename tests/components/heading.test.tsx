import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Heading } from "@/components/ui/heading";

describe("Heading", () => {
  it.each([1, 2, 3, 4] as const)("rend un h%i", (level) => {
    render(<Heading level={level}>Titre</Heading>);
    const el = screen.getByRole("heading", { level, name: "Titre" });
    expect(el.tagName).toBe(`H${level}`);
    expect(el).toHaveClass("text-foreground");
  });

  it("choisit une taille par défaut selon le niveau", () => {
    render(
      <>
        <Heading level={1}>Un</Heading>
        <Heading level={2}>Deux</Heading>
        <Heading level={3}>Trois</Heading>
        <Heading level={4}>Quatre</Heading>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Un" })).toHaveClass("text-title");
    expect(screen.getByRole("heading", { name: "Deux" })).toHaveClass("text-subtitle");
    expect(screen.getByRole("heading", { name: "Trois" })).toHaveClass("text-body-lg", "font-semibold");
    expect(screen.getByRole("heading", { name: "Quatre" })).toHaveClass("text-body-lg", "font-semibold");
  });

  it.each(["hero", "title", "subtitle"] as const)("la taille %s utilise la police d'affichage", (size) => {
    render(<Heading level={2} size={size}>Affiche</Heading>);
    const el = screen.getByRole("heading", { name: "Affiche" });
    expect(el).toHaveClass("font-display", `text-${size}`);
  });

  it("la taille section n'utilise pas la police d'affichage", () => {
    render(<Heading level={2} size="section">Section</Heading>);
    expect(screen.getByRole("heading", { name: "Section" })).not.toHaveClass("font-display");
  });

  it("dissocie le niveau de la taille", () => {
    render(<Heading level={3} size="hero">Grand h3</Heading>);
    const el = screen.getByRole("heading", { level: 3, name: "Grand h3" });
    expect(el).toHaveClass("text-hero");
  });
});
