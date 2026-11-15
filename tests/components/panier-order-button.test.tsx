// /panier : le bouton final porte « Commander avec obligation de paiement » (C. conso. L221-14) et
// la marge de pesée est choisie juste au-dessus. Rien n'est coché pour qui n'a jamais choisi, le
// choix enregistré d'un client connecté est repris, la requête de commande porte le choix, et un
// visiteur anonyme ne déclenche aucun appel d'API au montage (CLAUDE.md « Coût CPU Vercel »).
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import type { CartItem, CartState } from "@/lib/cart/cart-line";
import type { CheckoutSubmission } from "@/lib/cart/order-payload";
import type { OrderQuote } from "@/lib/services/orders/quote";
import PanierPage from "@/app/(client)/panier/page";

const ORDER_BUTTON = "Commander avec obligation de paiement";
const MISSING_CHOICE = "Choisissez votre marge de pesée pour commander";

const mocks = vi.hoisted(() => ({
  session: { ready: true, signedIn: false },
  submissions: [] as unknown[],
  quoteRequests: [] as unknown[],
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/cart/CartSuggestions", () => ({ default: () => null }));
vi.mock("@/lib/hooks/use-checkout-session", () => ({ useCheckoutSession: () => mocks.session }));
vi.mock("@/components/checkout/OrderCountdown", () => ({
  OrderCountdown: ({ submission }: { submission: unknown }) => {
    mocks.submissions.push(submission);
    return null;
  },
}));

const LINE: CartItem = {
  id: "line_1",
  productId: "prod_1",
  name: "Colis du mois",
  imageUrl: "",
  priceCents: 3735,
  quantity: 1,
  unit: "PIECE",
};

const QUOTE: OrderQuote = {
  shopId: "shop_1",
  paymentMethod: "ON_PICKUP",
  lines: [
    {
      productId: "prod_1",
      name: "Colis du mois",
      unit: "PIECE",
      quantity: 1,
      weightGrams: null,
      baseUnitPriceCents: 3735,
      unitPriceCents: 3735,
      lineTotalCents: 3735,
      cutOption: null,
      cutPriceCents: null,
      variant: null,
      sliceCount: null,
      sliceThickness: null,
      pieceCount: null,
      pieceLabel: null,
      itemNote: null,
    },
  ],
  subtotalCents: 3735,
  discount: null,
  discountRejection: null,
  serviceFeeCents: 0,
  totalCents: 3735,
  amountDueCents: 3735,
  minOrderCents: 0,
  belowMinimumOrder: false,
};

vi.mock("@/lib/hooks/use-order-quote", () => ({
  useOrderQuote: (request: unknown) => {
    mocks.quoteRequests.push(request);
    return { state: "ready", quote: QUOTE, error: null, refresh: async () => {} };
  },
}));

vi.mock("@/lib/hooks/use-cart", () => ({
  useCart: () => {
    const [items] = React.useState<CartItem[]>([LINE]);
    const state: CartState = {
      shopId: "shop_1",
      shopName: "Boucherie Test",
      shopSlug: "boucherie-test",
      items,
    };
    return { state, itemCount: 1, clear: vi.fn(), updateQty: vi.fn(), removeItem: vi.fn() };
  },
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

/** GET /api/users/me answers `status` with this saved choice; nothing else is expected. */
function serveProfile(status: number, weighTolerance: string | null) {
  fetchMock.mockImplementation(async (input) => {
    if (input === "/api/users/me")
      return reply(status, { success: status === 200, data: { weighTolerance } });
    throw new Error(`unexpected fetch ${input}`);
  });
}

function profileReads(): number {
  return fetchMock.mock.calls.filter(([input]) => input === "/api/users/me").length;
}

function orderButton(): HTMLElement {
  return screen.getByRole("button", { name: ORDER_BUTTON });
}

function lastSubmission(): CheckoutSubmission {
  return mocks.submissions.at(-1) as CheckoutSubmission;
}

beforeEach(() => {
  mocks.session = { ready: true, signedIn: false };
  mocks.submissions = [];
  mocks.quoteRequests = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("panier : bouton de commande et marge de pesée", () => {
  it("le bouton porte exactement « Commander avec obligation de paiement »", () => {
    render(<PanierPage />);
    expect(orderButton()).toHaveTextContent(new RegExp(`^${ORDER_BUTTON}$`));
    expect(screen.queryByText("Confirmer ma commande")).toBeNull();
  });

  it("visiteur anonyme : aucun appel d'API au montage, rien de coché, bouton désactivé", () => {
    render(<PanierPage />);

    expect(fetchMock).not.toHaveBeenCalled();
    for (const radio of screen.getAllByRole("radio", { name: /du total estimé/ })) {
      expect(radio).not.toBeChecked();
    }
    expect(orderButton()).toBeDisabled();
    const hint = screen.getByText(MISSING_CHOICE);
    expect(hint).toHaveAttribute("aria-live", "polite");
  });

  it("choisir une marge active le bouton et retire l'invite", () => {
    render(<PanierPage />);

    fireEvent.click(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ }));
    expect(orderButton()).toBeEnabled();
    expect(screen.queryByText(MISSING_CHOICE)).toBeNull();
  });

  it("la clause précède immédiatement le bouton : aucun autre contrôle entre les deux", () => {
    render(<PanierPage />);

    const group = screen.getByRole("group", { name: "Marge de pesée" });
    const button = orderButton();
    expect(group.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const controls = [...document.querySelectorAll("a, button, input, select, textarea")];
    const lastRadio = screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ });
    expect(controls.indexOf(button)).toBe(controls.indexOf(lastRadio) + 1);
    expect(screen.getByText(MISSING_CHOICE).compareDocumentPosition(button)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("le devis ne porte jamais le choix : seule la commande le transmet", () => {
    render(<PanierPage />);
    fireEvent.click(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ }));

    expect(mocks.quoteRequests.length).toBeGreaterThan(1);
    for (const request of mocks.quoteRequests) {
      expect(request).not.toHaveProperty("weighTolerance");
    }
  });

  it("le montant de la marge est calculé sur le total du devis (37,35 €)", () => {
    render(<PanierPage />);
    expect(screen.getByText("soit jusqu'à 1,86 € sur cette commande")).toBeInTheDocument();
    expect(screen.getByText("soit jusqu'à 3,73 € sur cette commande")).toBeInTheDocument();
  });

  it("invité : la commande envoyée porte le choix", () => {
    render(<PanierPage />);

    fireEvent.click(screen.getByRole("radio", { name: /^5\u00a0% du total estimé/ }));
    fireEvent.change(screen.getByPlaceholderText("Email *"), { target: { value: "a@b.fr" } });
    fireEvent.change(screen.getByPlaceholderText("Prénom *"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByPlaceholderText("Nom *"), { target: { value: "Lovelace" } });
    fireEvent.click(orderButton());

    expect(lastSubmission()).toMatchObject({
      endpoint: "/api/checkout/guest",
      body: { weighTolerance: "STANDARD", expectedTotalCents: 3735, paymentMethod: "ON_PICKUP" },
    });
  });

  it("client connecté : son choix enregistré est coché, signalé, et repris dans la commande", async () => {
    mocks.session = { ready: true, signedIn: true };
    serveProfile(200, "EXTENDED");
    render(<PanierPage />);

    const extended = screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ });
    await waitFor(() => expect(extended).toBeChecked());
    expect(extended).toHaveAccessibleName(/Votre choix enregistré$/);
    expect(profileReads()).toBe(1);

    fireEvent.click(orderButton());
    expect(lastSubmission()).toMatchObject({
      endpoint: "/api/orders",
      body: { weighTolerance: "EXTENDED" },
    });
  });

  it("client connecté qui change d'avis : la commande porte le nouveau choix", async () => {
    mocks.session = { ready: true, signedIn: true };
    serveProfile(200, "EXTENDED");
    render(<PanierPage />);

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ })).toBeChecked()
    );
    fireEvent.click(screen.getByRole("radio", { name: /^5\u00a0% du total estimé/ }));
    fireEvent.click(orderButton());
    expect(lastSubmission().body.weighTolerance).toBe("STANDARD");
  });

  it("client connecté sans choix enregistré : rien de coché tant qu'il n'a pas choisi", async () => {
    mocks.session = { ready: true, signedIn: true };
    serveProfile(200, null);
    render(<PanierPage />);

    await waitFor(() => expect(profileReads()).toBe(1));
    expect(await screen.findByText(MISSING_CHOICE)).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio", { name: /du total estimé/ })) {
      expect(radio).not.toBeChecked();
    }
    expect(orderButton()).toBeDisabled();
    expect(screen.queryByText("Votre choix enregistré")).toBeNull();
  });

  it("lecture du choix enregistré en échec : le client choisit, comme s'il n'avait jamais choisi", async () => {
    mocks.session = { ready: true, signedIn: true };
    serveProfile(500, null);
    render(<PanierPage />);

    expect(await screen.findByText(MISSING_CHOICE)).toBeInTheDocument();
    expect(orderButton()).toBeDisabled();
  });

  it("quitter le panier avant la réponse annule la lecture du choix enregistré", () => {
    mocks.session = { ready: true, signedIn: true };
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<PanierPage />);

    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("le paiement reste sur place : la carte « Mode de paiement » est inchangée", async () => {
    mocks.session = { ready: true, signedIn: true };
    serveProfile(200, null);
    render(<PanierPage />);

    expect(screen.getByText("Mode de paiement")).toBeInTheDocument();
    expect(screen.getByText("Paiement sur place")).toBeInTheDocument();
    await waitFor(() => expect(profileReads()).toBe(1));
  });
});
