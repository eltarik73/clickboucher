// The butcher layout reads the number of orders waiting for an answer from
// /api/boucher/orders/pending-count once for the nav and the dashboard, through useVisiblePolling
// (every 30 s, nothing on a hidden tab, backoff on error), never through an SSE stream (EventSource):
// a stream holds a function open, billed as memory for as long as the tab stays open.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { PendingOrderCountProvider, usePendingOrderCount } from "@/hooks/use-pending-order-count";
import BoucherLayout from "@/app/(boucher)/layout";
import BoucherDashboardPage from "@/app/(boucher)/boucher/dashboard/page";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { firstName: "Karim" } }) }));
const navigation = vi.hoisted(() => ({ pathname: "/boucher/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const PENDING_COUNT_URL = "/api/boucher/orders/pending-count";
const OFFERS_URL = "/api/shop/offers";
const SUMMARY_URL = "/api/boucher/orders/summary";
const STATUS_URL = "/api/boucher/shop/status";

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

const SUMMARY = {
  ordersToday: 12,
  revenueTodayCents: 45_600,
  recent: [
    {
      id: "order_1",
      orderNumber: "KG26-000166",
      status: "PREPARING",
      totalCents: 2_580,
      createdAt: "2026-11-15T09:30:00.000Z",
      expiresAt: null,
      itemCount: 7,
      user: { firstName: "Fatima", lastName: "Amrani" },
    },
  ],
};

const fetchMock = vi.fn(async (input: string): Promise<FakeResponse> => {
  if (input === PENDING_COUNT_URL) return pendingAnswer;
  if (input === OFFERS_URL) return offersAnswer;
  if (input === STATUS_URL) return reply(200, { success: true, data: SHOP });
  if (input === SUMMARY_URL) return reply(200, { success: true, data: SUMMARY });
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

function renderDashboard() {
  navigation.pathname = "/boucher/dashboard";
  return render(
    <BoucherLayout>
      <BoucherDashboardPage />
    </BoucherLayout>
  );
}

/** Where the dashboard shows the count: the « En attente » card and the « Commandes » shortcut. */
function dashboardCounts(count: number): HTMLElement[] {
  return within(screen.getByRole("main")).getAllByText(String(count));
}

/** An entry of the desktop sidebar. */
function sidebarLink(name: string): HTMLElement {
  return within(screen.getByRole("complementary")).getByRole("link", { name: new RegExp(name) });
}

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  servePending(0);
  serveProposals([]);
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
  it("reads the pending count once per 30 s for the nav and the dashboard together", async () => {
    servePending(2);
    renderDashboard();
    await flush();

    expect(reads(PENDING_COUNT_URL)).toBe(1);
    expect(dashboardCounts(2)).toHaveLength(2);
    expect(within(sidebarLink("Commandes")).getByText("2")).toBeInTheDocument();

    servePending(3);
    await flush(30_000);

    expect(reads(PENDING_COUNT_URL)).toBe(2);
    expect(dashboardCounts(3)).toHaveLength(2);
    expect(within(sidebarLink("Commandes")).getByText("3")).toBeInTheDocument();
  });

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
    renderDashboard();
    await flush();

    expect(reads(OFFERS_URL)).toBe(1);
    expect(within(sidebarLink("Offres")).getByText("2")).toBeInTheDocument();

    serveProposals(["PENDING", "PENDING", "PENDING"]);
    await flush(30_000);

    expect(reads(OFFERS_URL)).toBe(2);
    expect(within(sidebarLink("Offres")).getByText("3")).toBeInTheDocument();
  });
});

describe("/boucher/dashboard", () => {
  it("announces a new order and reads the figures and the shop status again", async () => {
    servePending(2);
    renderDashboard();
    await flush();
    expect(toast.success).not.toHaveBeenCalled();
    const summaryReads = reads(SUMMARY_URL);
    const statusReads = reads(STATUS_URL);

    servePending(3);
    await flush(30_000);

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Nouvelle commande !");
    expect(reads(SUMMARY_URL)).toBe(summaryReads + 1);
    expect(reads(STATUS_URL)).toBe(statusReads + 1);
    expect(eventSourceMock).not.toHaveBeenCalled();
  });

  it("does not announce the count the layout already held when the page opens", async () => {
    servePending(2);
    navigation.pathname = "/boucher/produits";
    const { rerender } = render(
      <BoucherLayout>
        <p>Produits</p>
      </BoucherLayout>
    );
    await flush();

    navigation.pathname = "/boucher/dashboard";
    rerender(
      <BoucherLayout>
        <BoucherDashboardPage />
      </BoucherLayout>
    );
    await flush();

    expect(reads(PENDING_COUNT_URL)).toBe(1);
    expect(dashboardCounts(2)).toHaveLength(2);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reads the figures again without a toast when the count goes down", async () => {
    servePending(3);
    renderDashboard();
    await flush();
    const summaryReads = reads(SUMMARY_URL);

    servePending(1);
    await flush(30_000);

    expect(dashboardCounts(1)).toHaveLength(2);
    expect(reads(SUMMARY_URL)).toBe(summaryReads + 1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reads the day figures and the shop status again every minute, pending count unchanged", async () => {
    servePending(2);
    renderDashboard();
    await flush();
    const summaryAtMount = reads(SUMMARY_URL);
    const statusAtMount = reads(STATUS_URL);
    expect(summaryAtMount).toBe(1);

    // An order picked up leaves the pending count at 2: only the minute refresh shows it.
    await flush(60_000);

    expect(toast.success).not.toHaveBeenCalled();
    expect(reads(SUMMARY_URL)).toBe(summaryAtMount + 1);
    expect(reads(STATUS_URL)).toBe(statusAtMount + 1);
  });

  it("labels the status of a recent order like every other screen", async () => {
    renderDashboard();
    await flush();

    const order = screen.getByText("KG26-000166").closest("a");
    if (!(order instanceof HTMLElement)) throw new Error("recent order link not found");
    expect(within(order).getByText("En préparation")).toBeInTheDocument();
  });
});
