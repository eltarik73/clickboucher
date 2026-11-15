// Carte produit de la vitrine : la carte est focalisable (Entrée ou Espace ouvre la fiche) et contient
// ses propres boutons. Une touche pressée sur « Ajouter au panier », « + » ou « - » agit sur ce
// bouton : la carte ne doit ni ouvrir la fiche ni empêcher l'action par défaut de la touche, qui est
// ce qui déclenche le clic du bouton dans un navigateur.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";

const MERGUEZ: ProductCardData = {
  id: "prod_merguez",
  shopId: "shop_1",
  name: "Merguez maison",
  description: null,
  imageUrl: null,
  priceCents: 450,
  unit: "PIECE",
  inStock: true,
  tags: [],
  origin: "",
  halalOrg: null,
  race: null,
  popular: false,
  promoPct: null,
  promoEnd: null,
  promoType: null,
  freshness: "FRAIS",
  customerNote: null,
  variants: [],
  weightPerPiece: null,
  pieceLabel: null,
  weightMargin: 15,
  minWeightG: 0,
  promoFixedCents: null,
  packOldPriceCents: null,
  packContent: null,
  packWeight: null,
  cutOptions: null,
  originRegion: null,
  raceDescription: null,
  elevageMode: null,
  elevageDetail: null,
  halalMethod: null,
  freshDate: null,
  freshDetail: null,
  isAntiGaspi: false,
  antiGaspiOrigPriceCents: null,
  antiGaspiStock: null,
  antiGaspiReason: null,
  isFlashSale: false,
  flashSaleStock: null,
  category: { id: "cat_saucisses", name: "Saucisses", emoji: null },
  images: [],
  labels: [],
};

/**
 * What a browser does with a key on a focused button: the keydown goes first (and bubbles to the
 * card); the button is then activated by a click unless a listener prevented the key's default.
 * Returns whether the default action survived.
 */
function pressOnButton(button: HTMLElement, key: "Enter" | " "): boolean {
  button.focus();
  const notPrevented = fireEvent.keyDown(button, { key });
  if (notPrevented) fireEvent.click(button);
  return notPrevented;
}

afterEach(cleanup);

describe("ProductCard au clavier", () => {
  it.each([["Enter" as const], [" " as const]])(
    "la touche %j sur « Ajouter au panier » ajoute le produit sans ouvrir la fiche",
    (key) => {
      const onTap = vi.fn();
      const onAdd = vi.fn();
      render(<ProductCard product={MERGUEZ} onTap={onTap} onAdd={onAdd} />);

      const kept = pressOnButton(screen.getByRole("button", { name: "Ajouter au panier" }), key);

      expect(onTap).not.toHaveBeenCalled();
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(kept).toBe(true);
    }
  );

  function renderInCart() {
    const callbacks = {
      onTap: vi.fn(),
      onAdd: vi.fn(),
      onIncrement: vi.fn(),
      onDecrement: vi.fn(),
    };
    render(<ProductCard product={MERGUEZ} cartQty={2} {...callbacks} />);
    return callbacks;
  }

  it.each([["Enter" as const], [" " as const]])(
    "la touche %j sur « + » augmente la quantité sans ouvrir la fiche",
    (key) => {
      const { onTap, onAdd, onIncrement, onDecrement } = renderInCart();

      const kept = pressOnButton(screen.getByRole("button", { name: "Augmenter la quantité" }), key);

      expect(onTap).not.toHaveBeenCalled();
      expect(onIncrement).toHaveBeenCalledTimes(1);
      expect(onDecrement).not.toHaveBeenCalled();
      expect(onAdd).not.toHaveBeenCalled();
      expect(kept).toBe(true);
    }
  );

  it.each([["Enter" as const], [" " as const]])(
    "la touche %j sur « - » diminue la quantité sans ouvrir la fiche",
    (key) => {
      const { onTap, onAdd, onIncrement, onDecrement } = renderInCart();

      const kept = pressOnButton(screen.getByRole("button", { name: "Diminuer la quantité" }), key);

      expect(onTap).not.toHaveBeenCalled();
      expect(onDecrement).toHaveBeenCalledTimes(1);
      expect(onIncrement).not.toHaveBeenCalled();
      expect(onAdd).not.toHaveBeenCalled();
      expect(kept).toBe(true);
    }
  );

  it.each([["Enter"], [" "]])("la touche %j sur la carte elle-même ouvre la fiche", (key) => {
    const onTap = vi.fn();
    const onAdd = vi.fn();
    render(<ProductCard product={MERGUEZ} onTap={onTap} onAdd={onAdd} />);

    const card = screen.getByRole("button", { name: "Merguez maison" });
    card.focus();
    const kept = fireEvent.keyDown(card, { key });

    expect(kept).toBe(false);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
