import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Card } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

describe("Card", () => {
  it("ne s'élève pas au survol par défaut", () => {
    render(<Card data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("rounded-card", "bg-card", "text-card-foreground", "shadow-card");
    expect(card.className).not.toContain("hover:shadow-elevated");
  });

  it("s'élève au survol quand elle est interactive", () => {
    render(<Card data-testid="card" interactive />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("hover:shadow-elevated");
    expect(card).not.toHaveAttribute("interactive");
  });
});

describe("Badge", () => {
  it.each([
    ["success", "bg-success-subtle", "text-success-text"],
    ["warning", "bg-warning-subtle", "text-warning-text"],
    ["destructive", "bg-destructive-subtle", "text-destructive-text"],
  ] as const)("la variante %s utilise la paire tonale", (variant, bg, text) => {
    const classes = classesOf(badgeVariants({ variant }));
    expect(classes).toEqual(expect.arrayContaining([bg, text, "text-micro"]));
  });

  it("pro écrit en rouge de texte", () => {
    expect(classesOf(badgeVariants({ variant: "pro" }))).toContain("text-brand");
  });

  it("refuse la variante sponsored", () => {
    // @ts-expect-error la variante sponsored n'existe plus
    render(<Badge variant="sponsored">Sponsorisé</Badge>);
    expect(screen.getByText("Sponsorisé")).toBeInTheDocument();
  });
});
