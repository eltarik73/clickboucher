// Les deux éditeurs de produit (page boucher /boucher/produits/… et fenêtre du catalogue de
// référence) : le prix au kilo d'une option de découpe se tape comme on l'écrit. Un champ qui
// reformate chaque frappe en « x.xx » change « 12. » en « 12.00 », empêche d'effacer un chiffre, et
// enregistre (puis fait facturer) une découpe à un prix que le boucher n'a pas tapé.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductFormPage, type EditProduct as PageProduct } from "@/app/(boucher)/boucher/produits/ProductFormPage";
import { ProductForm, type EditProduct as ModalProduct } from "@/app/(boucher)/boucher/produits/ProductForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const CATEGORIES = [{ id: "cat_boeuf", name: "Boeuf", emoji: null, order: 0 }];
const FIELD_NAME = "Prix au kilo de l'option Sans os";

const SHARED = {
  id: "prod_entrecote",
  name: "Entrecôte",
  description: null,
  imageUrl: null,
  priceCents: 2490,
  proPriceCents: null,
  unit: "KG",
  tags: [],
  origin: null,
  halalOrg: null,
  race: null,
  freshness: "FRAIS",
  promoPct: null,
  promoEnd: null,
  promoType: null,
  customerNote: null,
  minWeightG: 200,
  weightStepG: 50,
  popular: false,
  isActive: true,
  unitLabel: null,
  sliceOptions: null,
  variants: [],
  weightPerPiece: null,
  pieceLabel: null,
  weightMargin: 15,
  cutOptions: [{ name: "Sans os", priceCents: 1000 }],
  images: [],
  labels: [],
};

const PAGE_PRODUCT: PageProduct = {
  ...SHARED,
  boutiquePriceCents: 2290,
  categories: [{ id: "cat_boeuf" }],
};

const MODAL_PRODUCT: ModalProduct = { ...SHARED, categoryId: "cat_boeuf" };

// Each test mounts a whole 1 500-line editor: its role queries take seconds on a loaded machine.
const EDITOR_TEST_TIMEOUT_MS = 20_000;

let fetchMock: Mock<typeof fetch>;

beforeEach(() => {
  push.mockReset();
  fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
  );
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no window.scrollTo; ProductFormPage scrolls to the top on mount.
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function cutPriceField(): HTMLInputElement {
  const field = screen.getByRole("textbox", { name: FIELD_NAME });
  if (!(field instanceof HTMLInputElement)) throw new Error("le prix de la découpe n'est pas un <input>");
  return field;
}

/** Types `text` one keystroke at a time, as the browser reports it: the whole field after each key. */
function typeInto(field: HTMLInputElement, text: string): string[] {
  const shown: string[] = [];
  for (let end = 1; end <= text.length; end += 1) {
    fireEvent.change(field, { target: { value: text.slice(0, end) } });
    shown.push(field.value);
  }
  return shown;
}

/** The JSON body of the product PATCH sent to the API. */
function savedProductBody(): { cutOptions: unknown } {
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
  if (!patch) throw new Error("aucune requête PATCH envoyée");
  const [url, init] = patch;
  expect(url).toBe("/api/products/prod_entrecote");
  if (typeof init?.body !== "string") throw new Error("corps de la requête absent");
  const body: unknown = JSON.parse(init.body);
  if (typeof body !== "object" || body === null || !("cutOptions" in body)) {
    throw new Error("le corps n'a pas de cutOptions");
  }
  return body;
}

describe("prix d'une option de découpe, page produit du boucher (ProductFormPage)", () => {
  it("garde chaque frappe telle quelle, se vide, se retape, et enregistre 8,00 €/kg en 800 centimes", async () => {
    render(<ProductFormPage shopId="shop_1" categories={CATEGORIES} product={PAGE_PRODUCT} />);
    const field = cutPriceField();
    expect(field.value).toBe("10.00");

    expect(typeInto(field, "12.50")).toEqual(["1", "12", "12.", "12.5", "12.50"]);

    fireEvent.change(field, { target: { value: "" } });
    expect(field.value).toBe("");
    fireEvent.change(field, { target: { value: "8" } });
    expect(field.value).toBe("8");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/boucher/produits"));
    expect(savedProductBody().cutOptions).toEqual([{ name: "Sans os", priceCents: 800 }]);
  }, EDITOR_TEST_TIMEOUT_MS);
});

describe("prix d'une option de découpe, fenêtre produit en 4 étapes (ProductForm)", () => {
  it("garde chaque frappe telle quelle, se vide, se retape, et enregistre 8,00 €/kg en 800 centimes", async () => {
    render(
      <ProductForm
        shopId="shop_1"
        categories={CATEGORIES}
        product={MODAL_PRODUCT}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    const field = cutPriceField();
    expect(field.value).toBe("10.00");

    expect(typeInto(field, "12.50")).toEqual(["1", "12", "12.", "12.5", "12.50"]);

    fireEvent.change(field, { target: { value: "" } });
    expect(field.value).toBe("");
    fireEvent.change(field, { target: { value: "8" } });
    expect(field.value).toBe("8");

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Modifications enregistrees !");
    expect(savedProductBody().cutOptions).toEqual([{ name: "Sans os", priceCents: 800 }]);
  }, EDITOR_TEST_TIMEOUT_MS);
});
