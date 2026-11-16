// The butcher layout reads the number of orders waiting for an answer from
// /api/boucher/orders/pending-count once for the nav and the pages, through useVisiblePolling
// (every 30 s, nothing on a hidden tab, backoff on error), never through an SSE stream (EventSource):
// a stream holds a function open, billed as memory for as long as the tab stays open. The dashboard
// side: tests/components/boucher/dashboard-pending-count.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { PendingOrderCountProvider, usePendingOrderCount } from "@/hooks/use-pending-order-count";
import BoucherLayout from "@/app/(boucher)/layout";

const navigation = vi.hoisted(() => ({ pathname: "/boucher/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const PENDING_COUNT_URL = "/api/boucher/orders/pending-count";
const OFFERS_URL = "/api/shop/offers";

type FakeResponse = Pick<Response, "ok" | "status" | "json">;

/** Minimal answer: reading its body does not depend on the faked timers. */
function reply(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let pendingAnswer: FakeResponse = reply(200, { success: true, data: { pending: 0 } });
let offersAnswer: FakeResponse = reply(200, { success: true, data: { proposals: [] } });

function servePending(pending: number) {
  pendingAnswer = reply(200, { success: true, data: { pending } });
}

function serveProposals(statuses: string[]) {
  const proposals = statuses.map((status, i) => ({ id: `p${i}`, status }));
  offersAnswer = reply(200, { success: true, data: { proposals } });
}

const fetchMock = vi.fn(async (input: string): Promise<FakeResponse> => {
  if (input === PENDING_COUNT_URL) return pendingAnswer;
  if (input === OFFERS_URL) return offersAnswer;
  return reply(404, { success: false, error: { code: "NOT_FOUND", message: "Introuvable" } });
});

function reads(path: string): number {
  return fetchMock.mock.calls.filter(([input]) => input === path).length;
}

const eventSourceMock = vi.fn();

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  navigation.pathname = "/boucher/dashboard";
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  servePending(0);
  serveProposals([]);
  fetchMock.mockClear();
  eventSourceMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", eventSourceMock);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PendingOrderCountProvider", () => {
  it("is null before the first read, then reads on mount and every 30 s while visible", async () => {
    servePending(2);
    const { result, unmount } = renderHook(() => usePendingOrderCount(), {
      wrapper: PendingOrderCountProvider,
    });
    expect(result.current).toBeNull();

    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(PENDING_COUNT_URL);
    expect(result.current).toBe(2);

    await flush(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    servePending(5);
    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(5);

    unmount();
  });

  it("reads nothing on a hidden tab and reads at once when the tab comes back", async () => {
    visibility = "hidden";
    servePending(4);
    const { result, unmount } = renderHook(() => usePendingOrderCount(), {
      wrapper: PendingOrderCountProvider,
    });

    await flush(120_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    act(() => setVisibility("visible"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(4);

    unmount();
  });

  it("keeps the last count on a failed or malformed read and retries 5 s later", async () => {
    servePending(2);
    const { result, unmount } = renderHook(() => usePendingOrderCount(), {
      wrapper: PendingOrderCountProvider,
    });
    await flush();
    expect(result.current).toBe(2);

    pendingAnswer = reply(500, { success: false, error: { code: "INTERNAL_ERROR", message: "x" } });
    await flush(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(2);

    pendingAnswer = reply(200, { success: true, data: { pending: "3" } });
    await flush(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current).toBe(2);

    // Second failure in a row: next try 60 s later (backoff of useVisiblePolling).
    servePending(4);
    await flush(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.current).toBe(4);

    unmount();
  });

  it("never opens an EventSource", async () => {
    servePending(1);
    const { result, unmount } = renderHook(() => usePendingOrderCount(), {
      wrapper: PendingOrderCountProvider,
    });

    await flush(90_000);
    expect(result.current).toBe(1);
    expect(eventSourceMock).not.toHaveBeenCalled();

    unmount();
  });

  it("cannot be read outside the provider", () => {
    // React reports the render error before throwing it: keep the expected failure out of the log.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const report = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", report);

    expect(() => renderHook(() => usePendingOrderCount())).toThrow(PendingOrderCountProvider.name);
    window.removeEventListener("error", report);
  });
});

describe("(boucher) layout", () => {
  it("mounts no pending-count poll in kitchen mode", async () => {
    navigation.pathname = "/boucher/commandes";
    render(
      <BoucherLayout>
        <p>Cuisine</p>
      </BoucherLayout>
    );

    await flush(60_000);
    expect(reads(PENDING_COUNT_URL)).toBe(0);
  });

  it("shows the pending offer proposals in the nav and reads them again every 30 s", async () => {
    servePending(4);
    serveProposals(["PENDING", "PENDING", "ACCEPTED"]);
    render(
      <BoucherLayout>
        <p>Produits</p>
      </BoucherLayout>
    );
    await flush();
    const offers = () =>
      within(screen.getByRole("complementary")).getByRole("link", { name: /Offres/ });

    expect(reads(OFFERS_URL)).toBe(1);
    expect(within(offers()).getByText("2")).toBeInTheDocument();

    serveProposals(["PENDING", "PENDING", "PENDING"]);
    await flush(30_000);

    expect(reads(OFFERS_URL)).toBe(2);
    expect(within(offers()).getByText("3")).toBeInTheDocument();
  });
});
