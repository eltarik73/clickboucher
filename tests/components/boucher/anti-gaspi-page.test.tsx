// Page Anti-Gaspi du boucher : un produit dont le stock anti-gaspi est à 0 reste dans son mode mais
// n'est plus commandable (le devis le refuse). La page doit le dire, pas seulement « Stock: 0 ».
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AntiGaspiPage from "@/app/(boucher)/boucher/dashboard/anti-gaspi/page";

function antiGaspiProduct(id: string, antiGaspiStock: number | null) {
  return {
    id,
    name: `Merguez ${id}`,
    imageUrl: null,
    priceCents: 990,
    unit: "PIECE",
    inStock: true,
    isAntiGaspi: true,
    antiGaspiStock,
    antiGaspiOrigPriceCents: 1490,
    antiGaspiReason: "DLC_PROCHE",
    antiGaspiEndAt: null,
    categories: [],
  };
}

function serve(products: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: products }), { status: 200 }))
  );
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe("page Anti-Gaspi du boucher", () => {
  it("signale un produit épuisé comme n'étant plus commandable", async () => {
    serve([antiGaspiProduct("a", 0)]);
    render(<AntiGaspiPage />);
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Épuisé : les clients ne peuvent plus le commander.");
  });

  it("ne signale rien pour un stock restant ou illimité", async () => {
    serve([antiGaspiProduct("a", 2), antiGaspiProduct("b", null)]);
    render(<AntiGaspiPage />);
    await screen.findByText("Merguez a");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
