// The butcher dashboard reads the pending count of the (boucher) layout, shared with the nav: one read
// for both. A new order is announced, and any change of the count reads the day figures and the shop
// status again; they are read again every minute anyway.
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoucherLayout from "@/app/(boucher)/layout";
import BoucherDashboardPage from "@/app/(boucher)/boucher/dashboard/page";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { firstName: "Karim" } }) }));
const navigation = vi.hoisted(() => ({ pathname: "/boucher/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const PENDING_COUNT_URL = "/api/boucher/orders/pending-count";
const SUMMARY_URL = "/api/boucher/orders/summary";
const STATUS_URL = "/api/boucher/shop/status";

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

type FakeResponse = Pick<Response, "ok" | "status" | "json">;

/** Minimal answer: reading its body does not depend on the faked timers. */
function reply(data: unknown): FakeResponse {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

let pending = 0;

const fetchMock = vi.fn(async (input: string): Promise<FakeResponse> => {
  if (input === PENDING_COUNT_URL) return reply({ pending });
  if (input === STATUS_URL) return reply(SHOP);
  if (input === SUMMARY_URL) return reply(SUMMARY);
  if (input === "/api/shop/offers") return reply({ proposals: [] });
  throw new Error(`Unexpected fetch: ${input}`);
});

function reads(path: string): number {
  return fetchMock.mock.calls.filter(([input]) => input === path).length;
}

const eventSourceMock = vi.fn();

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

/** The « Commandes » entry of the desktop sidebar. */
function sidebarOrders(): HTMLElement {
  return within(screen.getByRole("complementary")).getByRole("link", { name: /Commandes/ });
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  pending = 0;
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

describe("/boucher/dashboard", () => {
  it("reads the pending count once per 30 s for the nav and the dashboard together", async () => {
    pending = 2;
    renderDashboard();
    await flush();

    expect(reads(PENDING_COUNT_URL)).toBe(1);
    expect(dashboardCounts(2)).toHaveLength(2);
    expect(within(sidebarOrders()).getByText("2")).toBeInTheDocument();

    pending = 3;
    await flush(30_000);

    expect(reads(PENDING_COUNT_URL)).toBe(2);
    expect(dashboardCounts(3)).toHaveLength(2);
    expect(within(sidebarOrders()).getByText("3")).toBeInTheDocument();
  });

  it("announces a new order and reads the figures and the shop status again", async () => {
    pending = 2;
    renderDashboard();
    await flush();
    expect(toast.success).not.toHaveBeenCalled();
    const summaryReads = reads(SUMMARY_URL);
    const statusReads = reads(STATUS_URL);

    pending = 3;
    await flush(30_000);

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Nouvelle commande !");
    expect(reads(SUMMARY_URL)).toBe(summaryReads + 1);
    expect(reads(STATUS_URL)).toBe(statusReads + 1);
    expect(eventSourceMock).not.toHaveBeenCalled();
  });

  it("does not announce the count the layout already held when the page opens", async () => {
    pending = 2;
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
    pending = 3;
    renderDashboard();
    await flush();
    const summaryReads = reads(SUMMARY_URL);

    pending = 1;
    await flush(30_000);

    expect(dashboardCounts(1)).toHaveLength(2);
    expect(reads(SUMMARY_URL)).toBe(summaryReads + 1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reads the day figures and the shop status again every minute, pending count unchanged", async () => {
    pending = 2;
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
