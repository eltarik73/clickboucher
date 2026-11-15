// Mode cuisine : état de la boutique. Une lecture au montage, une écriture par changement (corps
// envoyé tel quel, relecture et message si la route accepte), et le compte à rebours d'une pause :
// à zéro, une relecture, puis au plus une toutes les 15 s tant que le serveur rend la même fin.
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShopStatus } from "../use-shop-status";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const URL = "/api/boucher/shop/status";
const NOW = new Date("2026-11-13T10:00:00.000Z");

let server: { status: string; pauseEndsAt: string | null };
let patchStatus: number;

function respond(url: string, init?: RequestInit): Response {
  if (url !== URL) throw new Error(`Unexpected fetch: ${url}`);
  if (init?.method === "PATCH") return Response.json({ data: {} }, { status: patchStatus });
  return Response.json({ data: { name: "Boucherie Test", prepTimeMin: 20, ...server } });
}

/** Every request sent to the route, in order: "GET" or the PATCH body. */
function requests(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.map(([, init]) => (init?.method === "PATCH" ? String(init.body) : "GET"));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function mount() {
  const view = renderHook(() => useShopStatus());
  await advance(0);
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  server = { status: "OPEN", pauseEndsAt: null };
  patchStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => respond(url, init))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useShopStatus", () => {
  it("lit la boutique au montage", async () => {
    const { result } = await mount();

    expect(requests()).toEqual(["GET"]);
    expect(result.current).toMatchObject({ name: "Boucherie Test", prepTimeMin: 20 });
    expect(result.current.status).toBe("OPEN");
    expect(result.current.pauseCountdown).toBeNull();
  });

  it("suspend pour la durée choisie, relit l'état et l'annonce", async () => {
    const { result } = await mount();
    server = { status: "PAUSED", pauseEndsAt: new Date(NOW.getTime() + 30 * 60_000).toISOString() };

    await act(() =>
      result.current.setStatus({ action: "pause", reason: "Pause manuelle", durationMin: 30 })
    );
    await advance(0);

    expect(requests()).toEqual([
      "GET",
      '{"action":"pause","reason":"Pause manuelle","durationMin":30}',
      "GET",
    ]);
    expect(toast.success).toHaveBeenCalledWith("Pause 30 min");
    expect(result.current.status).toBe("PAUSED");
    expect(result.current.pauseCountdown).toBe("30:00");
  });

  it("ne relit ni n'annonce rien quand la route refuse, et signale une coupure réseau", async () => {
    const { result } = await mount();
    patchStatus = 403;

    await act(() => result.current.setStatus({ action: "close" }));
    expect(requests()).toEqual(["GET", '{"action":"close"}']);
    expect(toast.success).not.toHaveBeenCalled();

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(() => result.current.setStatus({ action: "resume" }));
    expect(toast.error).toHaveBeenCalledWith("Erreur");
  });

  it("compte la pause à rebours, relit à zéro puis au plus toutes les 15 s", async () => {
    server = { status: "PAUSED", pauseEndsAt: new Date(NOW.getTime() + 3_000).toISOString() };
    const { result } = await mount();
    expect(result.current.pauseCountdown).toBe("0:03");

    await advance(1_000);
    expect(result.current.pauseCountdown).toBe("0:02");

    // The server keeps answering the same end (expiry not run yet): one read at zero…
    await advance(2_000);
    expect(result.current.pauseCountdown).toBeNull();
    expect(requests()).toEqual(["GET", "GET"]);

    // …none during the next 15 s, then one more each time 15 s have gone by
    await advance(15_000);
    expect(requests()).toHaveLength(2);
    await advance(1_000);
    expect(requests()).toHaveLength(3);
    await advance(16_000);
    expect(requests()).toHaveLength(4);
  });

  it("s'arrête de relire dès que le serveur a levé la pause", async () => {
    server = { status: "PAUSED", pauseEndsAt: new Date(NOW.getTime() + 1_000).toISOString() };
    const { result } = await mount();
    server = { status: "OPEN", pauseEndsAt: null };

    await advance(1_000);
    await advance(60_000);

    expect(requests()).toEqual(["GET", "GET"]);
    expect(result.current.status).toBe("OPEN");
    expect(result.current.pauseCountdown).toBeNull();
  });
});
