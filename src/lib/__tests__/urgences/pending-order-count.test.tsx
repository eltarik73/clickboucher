// The butcher dashboard reads the number of orders waiting for an answer from
// /api/boucher/orders/pending-count through useVisiblePolling (every 30 s, nothing on a hidden tab,
// backoff on error), never through an SSE stream (EventSource): a stream holds a function open, billed
// as memory for as long as the tab stays open, and is cut every 30 s by the function timeout.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { usePendingOrderCount } from "@/hooks/use-pending-order-count";
import BoucherDashboardPage from "@/app/(boucher)/boucher/dashboard/page";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { firstName: "Karim" } }) }));

const PENDING_COUNT_URL = "/api/boucher/orders/pending-count";

type FakeResponse = Pick<Response, "ok" | "status" | "json">;

/** Minimal answer: reading its body does not depend on the faked timers. */
function reply(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let pendingAnswer: FakeResponse = reply(200, { success: true, data: { pending: 0 } });

function servePending(pending: number) {
  pendingAnswer = reply(200, { success: true, data: { pending } });
}

const fetchMock = vi.fn(async (input: string): Promise<FakeResponse> => {
  if (input === PENDING_COUNT_URL) return pendingAnswer;
  if (input === "/api/boucher/shop/status") return reply(200, { success: true, data: SHOP });
  if (input === "/api/boucher/orders/summary") return reply(200, { success: true, data: SUMMARY });
  return reply(404, { success: false, error: { code: "NOT_FOUND", message: "Introuvable" } });
});

function pendingCountCalls(): number {
  return fetchMock.mock.calls.filter(([input]) => input === PENDING_COUNT_URL).length;
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

const SHOP = {
  id: "shop_1",
  name: "Boucherie du Marché",
  rating: 4.8,
  ratingCount: 31,
  status: "OPEN",
  busyMode: false,
  busyExtraMin: 0,
  busyModeEndsAt: null,
  paused: false,
  pauseReason: null,
  pauseEndsAt: null,
  autoPaused: false,
  vacationMode: false,
  vacationEnd: null,
  vacationMessage: null,
  prepTimeMin: 20,
  effectivePrepTime: 20,
};

const SUMMARY = { ordersToday: 12, revenueTodayCents: 45_600, recent: [] };

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  servePending(0);
  fetchMock.mockClear();
  eventSourceMock.mockClear();
  toast.success.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", eventSourceMock);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("usePendingOrderCount", () => {
  it("reads the count on mount, then every 30 s while the tab is visible", async () => {
    servePending(2);
    const { result, unmount } = renderHook(() => usePendingOrderCount());

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
    const { result, unmount } = renderHook(() => usePendingOrderCount());

    await flush(120_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBe(0);

    act(() => setVisibility("visible"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(4);

    unmount();
  });

  it("does not report the first read, then reports each move of the count", async () => {
    servePending(2);
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() => usePendingOrderCount(onChange));

    await flush();
    expect(result.current).toBe(2);
    expect(onChange).not.toHaveBeenCalled();

    await flush(30_000);
    expect(onChange).not.toHaveBeenCalled();

    servePending(3);
    await flush(30_000);
    expect(result.current).toBe(3);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ previous: 2, current: 3 });

    unmount();
  });

  it("calls the latest onChange without restarting the polling", async () => {
    servePending(1);
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onChange }: { onChange: (change: { previous: number; current: number }) => void }) =>
        usePendingOrderCount(onChange),
      { initialProps: { onChange: first } }
    );
    await flush();

    rerender({ onChange: second });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    servePending(0);
    await flush(30_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ previous: 1, current: 0 });

    unmount();
  });

  it("keeps the last count on a failed or malformed read and retries 5 s later", async () => {
    servePending(2);
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() => usePendingOrderCount(onChange));
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
    expect(onChange).not.toHaveBeenCalled();

    // Second failure in a row: next try 60 s later (backoff of useVisiblePolling).
    servePending(4);
    await flush(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.current).toBe(4);
    expect(onChange).toHaveBeenCalledWith({ previous: 2, current: 4 });

    unmount();
  });

  it("never opens an EventSource", async () => {
    servePending(1);
    const { result, unmount } = renderHook(() => usePendingOrderCount());

    await flush(90_000);
    expect(result.current).toBe(1);
    expect(eventSourceMock).not.toHaveBeenCalled();

    unmount();
  });
});

describe("/boucher/dashboard", () => {
  it("polls the pending count instead of opening a stream, and announces a new order", async () => {
    servePending(2);
    render(<BoucherDashboardPage />);
    await flush();

    expect(eventSourceMock).not.toHaveBeenCalled();
    expect(pendingCountCalls()).toBe(1);
    // « En attente » card and the badge of the « Commandes » shortcut.
    expect(screen.getAllByText("2")).toHaveLength(2);

    const summaryReads = fetchMock.mock.calls.filter(
      ([input]) => input === "/api/boucher/orders/summary"
    ).length;
    servePending(3);
    await flush(30_000);

    expect(pendingCountCalls()).toBe(2);
    expect(screen.getAllByText("3")).toHaveLength(2);
    expect(toast.success).toHaveBeenCalledWith("Nouvelle commande !");
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/boucher/orders/summary")
    ).toHaveLength(summaryReads + 1);
    expect(eventSourceMock).not.toHaveBeenCalled();
  });
});
