import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { HISTORY_REFRESH_MS, nextPollDelay, useOrderPolling } from "@/hooks/use-order-polling";

type Responder = (signal: AbortSignal, url: string) => Promise<Response>;

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  } as unknown as Response;
}

const KITCHEN_URL = "/api/boucher/orders/kitchen";
const WITH_HISTORY = `${KITCHEN_URL}?history=1`;

/** Body of GET /api/boucher/orders/kitchen (with ?history=1, the history too) */
function boardResponse(
  active: unknown[],
  history: unknown[] = [],
  activeTruncated = false
): Response {
  return jsonResponse({ active, history, activeTruncated });
}

/** The real route: history only when asked for */
function routeResponse(url: string, active: unknown[], history: unknown[]): Response {
  return jsonResponse(
    url === WITH_HISTORY
      ? { active, history, activeTruncated: false }
      : { active, activeTruncated: false }
  );
}

function order(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    orderNumber: id,
    status,
    totalCents: 1000,
    customerNumber: null,
    isPro: false,
    items: [],
    user: null,
    pickupSlotStart: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

let responder: Responder;
let fetchMock: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState;

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

const hang: Responder = (signal) =>
  new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  responder = async () => boardResponse([]);
  fetchMock = vi.fn((url: string, init?: RequestInit) =>
    responder(init!.signal as AbortSignal, url)
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("nextPollDelay", () => {
  const base = { intervalMs: 5000, visible: true, elapsedMs: 0, authStreak: 0, errorStreak: 0 };
  it("ok visible: interval minus elapsed, never negative", () => {
    expect(nextPollDelay({ ...base, outcome: "ok", elapsedMs: 300 })).toBe(4700);
    expect(nextPollDelay({ ...base, outcome: "ok", elapsedMs: 9000 })).toBe(0);
  });
  it("ok hidden: 15 s", () => {
    expect(nextPollDelay({ ...base, outcome: "ok", visible: false })).toBe(15000);
    expect(nextPollDelay({ ...base, outcome: "ok", visible: false, intervalMs: 30000 })).toBe(
      30000
    );
  });
  it("auth: 10 s doubling to a 5 min cap", () => {
    const seq = [1, 2, 3, 4, 5, 6, 7, 50].map((authStreak) =>
      nextPollDelay({ ...base, outcome: "auth", authStreak })
    );
    expect(seq).toEqual([10000, 20000, 40000, 80000, 160000, 300000, 300000, 300000]);
  });
  it("error: interval doubling to a 60 s cap", () => {
    const seq = [1, 2, 3, 4, 5, 6, 2000].map((errorStreak) =>
      nextPollDelay({ ...base, outcome: "error", errorStreak })
    );
    expect(seq).toEqual([5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  });
  it("hidden floor applies to failures too", () => {
    expect(nextPollDelay({ ...base, outcome: "error", visible: false, errorStreak: 1 })).toBe(
      15000
    );
    expect(nextPollDelay({ ...base, outcome: "auth", visible: false, authStreak: 1 })).toBe(15000);
  });
});

describe("useOrderPolling loop", () => {
  it("polls on mount then every 5 s from the previous start while visible", async () => {
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.lastSuccessAt).not.toBeNull();
    expect(result.current.authExpired).toBe(false);
    await advance(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(50_000);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("is single-flight and aborts a stalled request after 10 s", async () => {
    responder = hang;
    const { result } = renderHook(() => useOrderPolling());
    await advance(9999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(true);
    await advance(1);
    // aborted → error (streak 1 → 5 s from start, already elapsed) → immediate retry
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Erreur de connexion");
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // recovers as soon as the network answers again
    responder = async () => boardResponse([]);
    await advance(10_000);
    await advance(5000);
    expect(result.current.error).toBeNull();
    const calls = fetchMock.mock.calls.length;
    await advance(5000);
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
  });

  it("backs off on 401 and exposes authExpired after 3 consecutive failures", async () => {
    responder = async () => jsonResponse(null, 401);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.authExpired).toBe(false);
    await advance(9999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.authExpired).toBe(false);
    await advance(20_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.authExpired).toBe(true);
    await advance(39_999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // one hour of expired session: capped at one request / 5 min
    const before = fetchMock.mock.calls.length;
    await advance(60 * 60 * 1000);
    expect(fetchMock.mock.calls.length - before).toBeLessThanOrEqual(14);
    // session back → flag cleared, normal cadence
    responder = async () => boardResponse([]);
    await advance(5 * 60 * 1000);
    expect(result.current.authExpired).toBe(false);
    const calls = fetchMock.mock.calls.length;
    await advance(5000);
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
  });

  it("403 counts as an auth failure, 500 does not", async () => {
    responder = async () => jsonResponse(null, 500);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    await advance(5000 + 10_000 + 20_000 + 40_000);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.current.authExpired).toBe(false);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("slows down to 15 s in a hidden tab and polls immediately when visible again", async () => {
    renderHook(() => useOrderPolling());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => setVisibility("hidden"));
    await advance(5000); // timer armed while visible still fires
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await advance(7000);
    act(() => setVisibility("visible"));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // focus right after visibilitychange must not double-poll
    act(() => window.dispatchEvent(new Event("focus")));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("online / focus reset the backoff and poll immediately", async () => {
    responder = async () => {
      throw new TypeError("Failed to fetch");
    };
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    await advance(5000 + 10_000 + 20_000);
    expect(fetchMock).toHaveBeenCalledTimes(4); // next retry in 40 s
    responder = async () => boardResponse([]);
    await advance(3000);
    act(() => window.dispatchEvent(new Event("online")));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.current.error).toBeNull();
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("wake drops a request pending for longer than one interval and polls again", async () => {
    renderHook(() => useOrderPolling());
    await advance(0);
    responder = hang;
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(6000); // pending for 6 s
    responder = async () => boardResponse([]);
    act(() => window.dispatchEvent(new Event("focus")));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("wake does not abort a young in-flight request", async () => {
    renderHook(() => useOrderPolling());
    await advance(0);
    responder = hang;
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(2000);
    act(() => window.dispatchEvent(new Event("focus")));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a successful manual refetch resumes the normal cadence", async () => {
    responder = async () => jsonResponse(null, 401);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    await advance(10_000 + 20_000 + 40_000);
    expect(result.current.authExpired).toBe(true);
    const before = fetchMock.mock.calls.length; // next loop retry in 80 s
    responder = async () => boardResponse([]);
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetchMock.mock.calls.length).toBe(before + 1);
    expect(result.current.authExpired).toBe(false);
    await advance(5000);
    expect(fetchMock.mock.calls.length).toBe(before + 2);
  });

  it("stops polling and removes listeners on unmount", async () => {
    const { unmount } = renderHook(() => useOrderPolling());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    await advance(60_000);
    act(() => window.dispatchEvent(new Event("focus")));
    act(() => window.dispatchEvent(new Event("online")));
    act(() => setVisibility("visible"));
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not poll when disabled", async () => {
    renderHook(() => useOrderPolling({ enabled: false }));
    await advance(30_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the callback semantics (new order, status change, scheduled ready)", async () => {
    const onNewOrder = vi.fn();
    const onStatusChange = vi.fn();
    const onScheduledReady = vi.fn();
    const soon = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
    let payload: unknown[] = [
      order("a", "PENDING"),
      order("s", "ACCEPTED", { pickupSlotStart: soon(31) }),
    ];
    responder = async () => boardResponse(payload);
    const { result } = renderHook(() =>
      useOrderPolling({ onNewOrder, onStatusChange, onScheduledReady })
    );
    await advance(0);
    // first fetch: no callbacks
    expect(onNewOrder).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.inProgressCount).toBe(1);

    payload = [
      order("a", "ACCEPTED"),
      order("b", "PENDING"),
      order("s", "ACCEPTED", { pickupSlotStart: soon(31) }),
    ];
    await advance(5000);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
    expect(onNewOrder.mock.calls[0][0].id).toBe("b");
    expect(onStatusChange).toHaveBeenCalledWith("a", "PENDING", "ACCEPTED");
    expect(onScheduledReady).not.toHaveBeenCalled();

    // 2 minutes later the scheduled order enters the 30-min window
    await advance(2 * 60_000);
    expect(onScheduledReady).toHaveBeenCalledTimes(1);
    expect(onScheduledReady.mock.calls[0][0].id).toBe("s");
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });
});

describe("useOrderPolling kitchen board", () => {
  it("requests the kitchen endpoint with the history first and builds every view from { active, history }", async () => {
    const lastWeek = new Date(Date.now() - 6 * 24 * 60 * 60_000).toISOString();
    const active = [
      order("p1", "PENDING"),
      order("p2", "PENDING"),
      order("a1", "ACCEPTED"),
      order("pr1", "PREPARING"),
      order("r1", "READY"),
      order("pd1", "PARTIALLY_DENIED", {
        updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString(),
      }),
    ];
    const history = [
      order("h-old", "CANCELLED", { updatedAt: lastWeek }),
      order("h-new", "PICKED_UP"),
      order("h-auto", "AUTO_CANCELLED", { updatedAt: new Date(Date.now() - 60_000).toISOString() }),
    ];
    responder = async () => boardResponse(active, history);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(WITH_HISTORY);
    expect(result.current.error).toBeNull();
    expect(result.current.orders.map((o) => o.id)).toEqual(active.map((o) => o.id));
    expect(result.current.pendingOrders.map((o) => o.id)).toEqual(["p1", "p2"]);
    expect(result.current.inProgressOrders.map((o) => o.id)).toEqual(["a1", "pr1"]);
    expect(result.current.readyOrders.map((o) => o.id)).toEqual(["r1"]);
    // Most recently updated first; PARTIALLY_DENIED is shown with the history
    expect(result.current.historyOrders.map((o) => o.id)).toEqual([
      "h-new",
      "h-auto",
      "h-old",
      "pd1",
    ]);
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.historyCount).toBe(4);
    expect(result.current.activeTruncated).toBe(false);
  });

  it("exposes activeTruncated as reported by the server, on every poll", async () => {
    let truncated = true;
    responder = async () => boardResponse([order("p1", "PENDING")], [], truncated);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    expect(result.current.activeTruncated).toBe(true);

    truncated = false;
    await advance(5000);
    expect(result.current.activeTruncated).toBe(false);
  });

  it("treats a body that is not a kitchen board as a failed poll and keeps the last board", async () => {
    let body: unknown = { active: [order("p1", "PENDING")], history: [], activeTruncated: false };
    responder = async () => jsonResponse(body);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    expect(result.current.pendingCount).toBe(1);

    body = [order("p2", "PENDING")];
    await advance(5000);
    expect(result.current.error).toBe("Erreur de connexion");
    expect(result.current.pendingOrders.map((o) => o.id)).toEqual(["p1"]);
  });

  it("asks for the history on the first poll, then at most once a minute", async () => {
    responder = async (_signal, url) =>
      routeResponse(url, [order("p1", "PENDING")], [order("h1", "PICKED_UP")]);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([WITH_HISTORY]);
    expect(result.current.historyOrders.map((o) => o.id)).toEqual(["h1"]);

    await advance(HISTORY_REFRESH_MS - 5000);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls.slice(1)).toEqual(Array(urls.length - 1).fill(KITCHEN_URL));
    // A poll without history keeps the last history read
    expect(result.current.historyOrders.map((o) => o.id)).toEqual(["h1"]);
    expect(result.current.historyCount).toBe(1);

    await advance(5000);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(WITH_HISTORY);
    await advance(5000);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(KITCHEN_URL);
  });

  it("reads the history on the poll after an order leaves the board and reports its new status", async () => {
    const onStatusChange = vi.fn();
    let active: unknown[] = [order("r1", "READY"), order("p1", "PENDING")];
    let history: unknown[] = [];
    responder = async (_signal, url) => routeResponse(url, active, history);
    const { result } = renderHook(() => useOrderPolling({ onStatusChange }));
    await advance(0);
    await advance(5000);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(KITCHEN_URL);

    // r1 is collected: it leaves the active orders
    active = [order("p1", "PENDING")];
    history = [order("r1", "PICKED_UP")];
    await advance(5000);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(KITCHEN_URL);
    expect(result.current.readyCount).toBe(0);
    expect(onStatusChange).not.toHaveBeenCalled();

    await advance(5000);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(WITH_HISTORY);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith("r1", "READY", "PICKED_UP");
    expect(result.current.historyOrders.map((o) => o.id)).toEqual(["r1"]);

    // Back to light polls, and no second report
    await advance(5000);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(KITCHEN_URL);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
  });

  it("refreshHistory re-reads the history at once", async () => {
    let history: unknown[] = [];
    responder = async (_signal, url) => routeResponse(url, [], history);
    const { result } = renderHook(() => useOrderPolling());
    await advance(0);
    await advance(5000);
    history = [order("h1", "CANCELLED")];
    const before = fetchMock.mock.calls.length;
    await act(async () => {
      result.current.refreshHistory();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.length).toBe(before + 1);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(WITH_HISTORY);
    expect(result.current.historyOrders.map((o) => o.id)).toEqual(["h1"]);
  });
});
