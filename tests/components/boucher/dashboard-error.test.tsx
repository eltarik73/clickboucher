// The butcher dashboard reads the shop status and the day summary at mount, then every minute. When
// neither could ever be read, it says so instead of showing an empty dashboard.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoucherLayout from "@/app/(boucher)/layout";
import BoucherDashboardPage from "@/app/(boucher)/boucher/dashboard/page";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { firstName: "Karim" } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/boucher/dashboard" }));

const ERROR_MESSAGE = "Erreur de connexion au serveur";

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

const answers = { status: true, summary: true };

type FakeResponse = Pick<Response, "ok" | "status" | "json">;

/** Minimal answer: reading its body does not depend on the faked timers. */
function reply(ok: boolean, data: unknown): FakeResponse {
  const body = ok ? { success: true, data } : { success: false, error: { code: "INTERNAL_ERROR" } };
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

const fetchMock = vi.fn(async (input: string): Promise<FakeResponse> => {
  if (input === "/api/boucher/shop/status") return reply(answers.status, SHOP);
  if (input === "/api/boucher/orders/summary") return reply(answers.summary, SUMMARY);
  if (input === "/api/boucher/orders/pending-count") return reply(true, { pending: 0 });
  return reply(false, null);
});

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderDashboard() {
  render(
    <BoucherLayout>
      <BoucherDashboardPage />
    </BoucherLayout>
  );
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  answers.status = true;
  answers.summary = true;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("tableau de bord boucher : premier chargement", () => {
  it("affiche l'écran d'erreur quand ni la boutique ni le résumé du jour n'ont pu être lus", async () => {
    answers.status = false;
    answers.summary = false;
    renderDashboard();
    await flush();

    expect(screen.getByText(ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Bonjour/ })).toBeNull();
  });

  it("affiche le tableau de bord dès qu'une lecture suivante réussit", async () => {
    answers.status = false;
    answers.summary = false;
    renderDashboard();
    await flush();
    expect(screen.getByText(ERROR_MESSAGE)).toBeInTheDocument();

    answers.status = true;
    answers.summary = true;
    // First failure: useVisiblePolling tries again 5 s later.
    await flush(5_000);

    expect(screen.queryByText(ERROR_MESSAGE)).toBeNull();
    expect(screen.getByRole("heading", { name: "Bonjour Karim" })).toBeInTheDocument();
  });

  it("affiche le tableau de bord quand une seule des deux lectures échoue", async () => {
    answers.summary = false;
    renderDashboard();
    await flush();

    expect(screen.queryByText(ERROR_MESSAGE)).toBeNull();
    expect(screen.getByRole("heading", { name: "Bonjour Karim" })).toBeInTheDocument();
    expect(screen.getByText("Boucherie du Marché")).toBeInTheDocument();
  });
});
