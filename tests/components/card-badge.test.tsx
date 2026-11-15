import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Card } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

describe("Card", () => {
  it("porte la surface et l'ombre de carte", () => {
    render(<Card data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("rounded-card", "bg-card", "text-card-foreground", "shadow-card");
  });
});

describe("Badge", () => {
  it.each([
    ["neutral", "bg-muted", "text-muted-foreground"],
    ["info", "bg-info-subtle", "text-info-text"],
    ["success", "bg-success-subtle", "text-success-text"],
    ["warning", "bg-warning-subtle", "text-warning-text"],
    ["destructive", "bg-destructive-subtle", "text-destructive-text"],
  ] as const)(
    "la variante %s utilise la paire tonale, sans retour à la ligne",
    (variant, bg, text) => {
      const classes = classesOf(badgeVariants({ variant }));
      expect(classes).toEqual(
        expect.arrayContaining([bg, text, "text-micro", "whitespace-nowrap"])
      );
    }
  );

  it("pro écrit en rouge de texte", () => {
    expect(classesOf(badgeVariants({ variant: "pro" }))).toContain("text-brand");
  });

  it("refuse la variante sponsored", () => {
    // @ts-expect-error la variante sponsored n'existe plus
    render(<Badge variant="sponsored">Sponsorisé</Badge>);
    expect(screen.getByText("Sponsorisé")).toBeInTheDocument();
  });
});
