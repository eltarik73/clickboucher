// La marge de pesée au-dessus du bouton de commande : aucune case cochée d'avance (C. conso.
// L121-17), les deux choix avec leurs termes (src/lib/pricing/tolerance.ts), le montant que la marge
// représente sur cette commande, et le choix enregistré du client signalé comme tel.
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeighToleranceChoice } from "@/components/cart/WeighToleranceChoice";

const STANDARD = /^5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus/;
const EXTENDED = /^10\u00a0% du total estimé, 20,00\u00a0€ au\u00a0plus/;

afterEach(cleanup);

describe("WeighToleranceChoice", () => {
  it("rien n'est coché tant que le client n'a pas choisi", () => {
    render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={null}
        onChange={vi.fn()}
      />
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) expect(radio).not.toBeChecked();
    expect(screen.queryByText("Votre choix enregistré")).toBeNull();
  });

  it("un groupe nommé « Marge de pesée », avec l'explication et les deux choix", () => {
    render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={null}
        onChange={vi.fn()}
      />
    );

    const group = screen.getByRole("group", { name: "Marge de pesée" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveAccessibleDescription(
      "Pour gagner du temps, votre boucher ajuste le prix après la pesée sans vous déranger, dans la limite choisie. Au-delà, il vous demande votre accord ; une baisse de prix s'applique toujours."
    );
    const standard = within(group).getByRole("radio", { name: STANDARD });
    const extended = within(group).getByRole("radio", { name: EXTENDED });
    expect(standard).toHaveAttribute("value", "STANDARD");
    expect(extended).toHaveAttribute("value", "EXTENDED");
    expect(standard).toHaveAttribute("name", extended.getAttribute("name"));
    expect(screen.queryByText(/soit jusqu'à/)).toBeNull();
  });

  it("choisir une option la transmet au parent", () => {
    const onChange = vi.fn();
    render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={null}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: EXTENDED }));
    expect(onChange).toHaveBeenCalledWith("EXTENDED");
    fireEvent.click(screen.getByRole("radio", { name: STANDARD }));
    expect(onChange).toHaveBeenLastCalledWith("STANDARD");
  });

  it("le choix enregistré est coché et signalé, l'autre non", () => {
    render(
      <WeighToleranceChoice
        value="EXTENDED"
        saved="EXTENDED"
        estimatedTotalCents={null}
        onChange={vi.fn()}
      />
    );

    const extended = screen.getByRole("radio", { name: EXTENDED });
    expect(extended).toBeChecked();
    expect(extended).toHaveAccessibleName(/Votre choix enregistré$/);
    expect(screen.getByRole("radio", { name: STANDARD })).not.toBeChecked();
    expect(screen.getAllByText("Votre choix enregistré")).toHaveLength(1);
  });

  it("panier de 37,35 € : jusqu'à 1,86 € (5 %) ou 3,73 € (10 %), arrondi au centime inférieur", () => {
    render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={3735}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("radio", { name: STANDARD })).toHaveAccessibleName(
      "5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus soit jusqu'à 1,86 € sur cette commande"
    );
    expect(screen.getByRole("radio", { name: EXTENDED })).toHaveAccessibleName(
      "10\u00a0% du total estimé, 20,00\u00a0€ au\u00a0plus soit jusqu'à 3,73 € sur cette commande"
    );
  });

  it("gros panier : la marge s'arrête au plafond de 10 € ou de 20 €", () => {
    render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={50000}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("soit jusqu'à 10,00 € sur cette commande")).toBeInTheDocument();
    expect(screen.getByText("soit jusqu'à 20,00 € sur cette commande")).toBeInTheDocument();
  });

  it("désactivé : aucun choix possible", () => {
    render(
      <WeighToleranceChoice
        value="STANDARD"
        saved={null}
        estimatedTotalCents={null}
        onChange={vi.fn()}
        disabled
      />
    );

    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });

  it("au panier, une région polie demande un choix tant que rien n'est coché", () => {
    const { rerender } = render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={null}
        onChange={vi.fn()}
        requireChoice
      />
    );

    const hint = screen.getByText("Choisissez votre marge de pesée pour commander");
    expect(hint).toHaveAttribute("aria-live", "polite");
    rerender(
      <WeighToleranceChoice
        value="STANDARD"
        saved={null}
        estimatedTotalCents={null}
        onChange={vi.fn()}
        requireChoice
      />
    );
    expect(hint).toBeEmptyDOMElement();
    expect(hint).toBeInTheDocument();
  });

  it("au profil, pas d'invite : le choix reste libre", () => {
    render(
      <WeighToleranceChoice
        value={null}
        saved={null}
        estimatedTotalCents={null}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText("Choisissez votre marge de pesée pour commander")).toBeNull();
  });

  it("mode sombre : la carte, le titre, le texte et les options ont leurs variantes dark:", () => {
    render(
      <WeighToleranceChoice
        value={null}
        saved="STANDARD"
        estimatedTotalCents={3735}
        onChange={vi.fn()}
      >
        <p>Pied de carte</p>
      </WeighToleranceChoice>
    );

    const group = screen.getByRole("group", { name: "Marge de pesée" });
    const card = group.parentElement as HTMLElement;
    expect(card.className).toMatch(/dark:bg-/);
    expect(card.className).toMatch(/dark:border-/);
    for (const label of group.querySelectorAll("label")) {
      expect(label.className).toMatch(/dark:border-/);
    }
    expect(screen.getByText("Votre choix enregistré").className).toMatch(/dark:text-/);
    expect(within(card).getByText("Pied de carte")).toBeInTheDocument();
  });
});
