// Le bandeau anti-gaspi de la page boutique : un produit aussi en vente flash est limité par le plus
// petit des deux compteurs, comme au devis (src/lib/pricing/limited-stock.ts).
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AntiGaspiBanner } from "@/components/client/AntiGaspiBanner";

vi.mock("@/lib/hooks/use-cart", () => ({ useCart: () => ({ addItem: vi.fn() }) }));

const shop = { id: "s1", name: "Boucherie Test", slug: "boucherie-test" };

function product(overrides: {
  antiGaspiStock: number | null;
  isFlashSale?: boolean;
  flashSaleStock?: number | null;
  priceCents?: number;
  unit?: string;
  promoPct?: number | null;
}) {
  return {
    id: "p1",
    name: "Merguez",
    imageUrl: null,
    priceCents: 990,
    unit: "PIECE",
    antiGaspiOrigPriceCents: 1490,
    antiGaspiReason: "DLC_PROCHE",
    promoPct: null,
    promoType: null,
    promoFixedCents: null,
    promoEnd: null,
    category: { name: "Saucisses" },
    images: [{ url: "https://example.test/merguez.webp" }],
    ...overrides,
  };
}

afterEach(cleanup);

describe("AntiGaspiBanner", () => {
  it("n'affiche pas un produit anti-gaspi dont la vente flash est épuisée", () => {
    const { container } = render(
      <AntiGaspiBanner
        shop={shop}
        products={[product({ antiGaspiStock: 4, isFlashSale: true, flashSaleStock: 0 })]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("annonce le plus petit des deux compteurs", () => {
    render(
      <AntiGaspiBanner
        shop={shop}
        products={[product({ antiGaspiStock: 4, isFlashSale: true, flashSaleStock: 2 })]}
      />
    );
    expect(screen.getByText("Plus que 2")).toBeInTheDocument();
  });

  it("sans vente flash, garde le compteur anti-gaspi", () => {
    render(<AntiGaspiBanner shop={shop} products={[product({ antiGaspiStock: 3 })]} />);
    expect(screen.getByText("Plus que 3")).toBeInTheDocument();
  });

  it("affiche le prix après la promotion du produit, dans le bandeau et l'ajout rapide", () => {
    render(
      <AntiGaspiBanner
        shop={shop}
        products={[product({ antiGaspiStock: 4, priceCents: 1096, unit: "KG", promoPct: 15 })]}
      />
    );

    expect(screen.getByText("9,32 €")).toBeInTheDocument();
    expect(screen.queryByText("10,96 €")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Merguez/ }));

    expect(screen.getAllByText("9,32 €")).toHaveLength(2);
    expect(screen.getByText("Total estimé").nextSibling).toHaveTextContent("4,66 €");
  });
});
