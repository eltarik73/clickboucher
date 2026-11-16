// The order GET /api/orders/[id]/status answers and a fetch double serving it, shared by the tests
// of useOrderTracker and of the tracking page /suivi/[id] (SuiviClient). Each test file stubs
// `fetch` with fetchMock and resets it around its own tests.
import { vi } from "vitest";
import type { OrderStatus } from "@prisma/client";
import type { TrackedOrder } from "@/hooks/useOrderTracker";

/** 500 g of merguez at 24,50 €, EXTENDED tolerance (10 %, 20,00 € at most) frozen on 24,50 €. */
export function trackedOrder(status: OrderStatus): TrackedOrder {
  return {
    id: "ord_1",
    status,
    displayNumber: "#12",
    totalCents: 2450,
    weighToleranceRateBps: 1000,
    weighToleranceCapCents: 2000,
    estimatedTotalCents: 2450,
    boucherNote: null,
    estimatedReady: null,
    actualReady: status === "READY" ? "2026-11-14T12:30:00.000Z" : null,
    pickedUpAt: null,
    createdAt: "2026-11-14T12:00:00.000Z",
    updatedAt: "2026-11-14T12:30:00.000Z",
    items: [
      {
        id: "it_1",
        name: "Merguez",
        quantity: 0.5,
        unit: "KG",
        totalCents: 2450,
        weightGrams: 500,
      },
    ],
    priceAdjustment: null,
  };
}

/** A bare response: reading its body does not wait on the fake timers. */
export function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

export const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

export function serve(status: number, body: unknown) {
  fetchMock.mockImplementation(async () => reply(status, body));
}

export function serveOrder(status: OrderStatus) {
  serve(200, { success: true, data: trackedOrder(status) });
}
