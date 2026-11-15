// The order confirmation overlay counts down, then sends the order once. Cancelling before the end
// sends nothing; « Réessayer » counts down again and sends the same body, hence the same
// idempotency key, so the server answers with the order already created when the first one got
// through.
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderCountdown } from "@/components/checkout/OrderCountdown";
import type { CheckoutSubmission } from "@/lib/cart/order-payload";

const SUBMISSION: CheckoutSubmission = {
  endpoint: "/api/orders",
  body: {
    shopId: "shop_1",
    items: [{ productId: "prod_1", quantity: 2 }],
    paymentMethod: "ON_PICKUP",
    idempotencyKey: "6f1c2b9e-3d4a-4b5c-8d7e-9f0a1b2c3d4e",
    expectedTotalCents: 2_580,
  },
};

type FakeResponse = Pick<Response, "ok" | "status" | "json">;

/** Minimal answer: reading its body does not depend on the faked timers. */
function reply(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const CREATED = reply(201, { success: true, data: { id: "order_1", orderNumber: "KG26-000166" } });
const REFUSED = reply(500, {
  success: false,
  error: { code: "INTERNAL_ERROR", message: "Erreur lors de la commande" },
});

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<FakeResponse>>();

const callbacks = {
  onCancel: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  onPriceChanged: vi.fn(),
};

/** Lets `seconds` go by, one second per act() so that the screen renders each second. */
async function wait(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
  }
}

function renderCountdown() {
  render(
    <StrictMode>
      <OrderCountdown
        submission={SUBMISSION}
        itemCount={2}
        totalCents={2_580}
        shopName="Boucherie du Marché"
        pickupLabel="Retrait : Dès que possible"
        {...callbacks}
      />
    </StrictMode>
  );
}

function sentBodies(): unknown[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(CREATED);
  Object.values(callbacks).forEach((callback) => callback.mockClear());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("OrderCountdown", () => {
  it("counts the seconds down, then sends the order exactly once", async () => {
    renderCountdown();
    expect(screen.getByLabelText("5 secondes avant envoi")).toBeInTheDocument();
    expect(screen.getByText("2 articles · 25,80 €")).toBeInTheDocument();

    await wait(1);
    expect(screen.getByLabelText("4 secondes avant envoi")).toBeInTheDocument();

    await wait(3);
    expect(screen.getByLabelText("1 secondes avant envoi")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await wait(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({ method: "POST" })
    );
    expect(sentBodies()).toEqual([SUBMISSION.body]);
    expect(screen.getByText("Commande envoyée !")).toBeInTheDocument();
    expect(callbacks.onSuccess).not.toHaveBeenCalled();

    await wait(2);
    expect(callbacks.onSuccess).toHaveBeenCalledTimes(1);
    expect(callbacks.onSuccess).toHaveBeenCalledWith({ id: "order_1", orderNumber: "KG26-000166" });

    await wait(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when cancelled before the end", async () => {
    renderCountdown();
    await wait(3);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);

    await wait(30);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
  });

  it("counts down again on « Réessayer » and sends the same body once more", async () => {
    fetchMock.mockResolvedValueOnce(REFUSED);
    renderCountdown();
    await wait(5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Oups, une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText("Erreur lors de la commande")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(screen.getByLabelText("5 secondes avant envoi")).toBeInTheDocument();

    await wait(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await wait(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBodies()).toEqual([SUBMISSION.body, SUBMISSION.body]);

    await wait(30);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callbacks.onSuccess).toHaveBeenCalledTimes(1);
  });
});
