// /panier : « Vider le panier » fait disparaître le bouton « Vider » qui a ouvert la confirmation.
// Le focus va alors au titre du panier vide ; Échap et « Annuler » le rendent toujours à « Vider ».
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import type { CartItem, CartState } from "@/lib/cart/cart-line";
import PanierPage from "@/app/(client)/panier/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/cart/CartSuggestions", () => ({ default: () => null }));
vi.mock("@/lib/hooks/use-checkout-session", () => ({
  useCheckoutSession: () => ({ ready: true, signedIn: false }),
}));
vi.mock("@/lib/hooks/use-order-quote", () => ({
  useOrderQuote: () => ({ state: "loading", quote: null, error: null, refresh: async () => {} }),
}));

const LINE: CartItem = {
  id: "line_1",
  productId: "prod_1",
  name: "Merguez",
  imageUrl: "",
  priceCents: 450,
  quantity: 2,
  unit: "PIECE",
};

vi.mock("@/lib/hooks/use-cart", () => ({
  useCart: () => {
    const [items, setItems] = React.useState<CartItem[]>([LINE]);
    const state: CartState = {
      shopId: "shop_1",
      shopName: "Boucherie Test",
      shopSlug: "boucherie-test",
      items,
    };
    return {
      state,
      itemCount: items.length,
      clear: () => setItems([]),
      updateQty: vi.fn(),
      removeItem: vi.fn(),
    };
  },
}));

function openClearDialog() {
  const opener = screen.getByRole("button", { name: "Vider" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { slots: [] } }) }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("panier : focus après « Vider le panier ? »", () => {
  it("vidé : le focus va au titre « Mon panier » du panier vide", async () => {
    render(<PanierPage />);
    openClearDialog();
    const dialog = await screen.findByRole("alertdialog", { name: "Vider le panier ?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Vider le panier" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Mon panier" });
    expect(screen.getByText("Votre panier est vide")).toBeInTheDocument();
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("Annuler : le panier reste et le focus revient à « Vider »", async () => {
    render(<PanierPage />);
    const opener = openClearDialog();
    const dialog = await screen.findByRole("alertdialog", { name: "Vider le panier ?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));

    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByText("Votre panier est vide")).toBeNull();
  });
});
