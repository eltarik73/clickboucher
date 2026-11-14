import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("rend un titre de niveau 2, la description et l'action", () => {
    render(
      <EmptyState
        icon={<svg data-testid="icone" />}
        title="Votre panier est vide"
        description="Ajoutez des produits pour commencer."
        action={<a href="/">Découvrir les boucheries</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Votre panier est vide" })).toBeInTheDocument();
    expect(screen.getByText("Ajoutez des produits pour commencer.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Découvrir les boucheries" })).toBeInTheDocument();
    expect(screen.getByTestId("icone").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("accepte un titre de niveau 3 et se passe de description", () => {
    const { container } = render(<EmptyState icon={<svg />} title="Aucune commande" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Aucune commande" })).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("n'anime pas son entrée", () => {
    const { container } = render(<EmptyState icon={<svg />} title="Vide" />);
    expect(container.innerHTML).not.toMatch(/animate-/);
  });
});
