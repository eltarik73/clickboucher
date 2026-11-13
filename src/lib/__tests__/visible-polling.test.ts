import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  nextPollDelay,
  nextOrderPollDelay,
  startVisiblePolling,
  useVisiblePolling,
} from "@/hooks/useVisiblePolling";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Promesse résolue à la main, pour simuler une requête en cours. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("nextPollDelay", () => {
  it("garde la cadence normale après un succès", () => {
    expect(nextPollDelay(30_000, 0)).toBe(30_000);
    expect(nextPollDelay(60_000, 0)).toBe(60_000);
  });

  it("retente vite après le premier échec, puis backoff exponentiel plafonné à 15 min", () => {
    expect([1, 2, 3, 4, 5, 6].map((f) => nextPollDelay(30_000, f))).toEqual([
      5_000, 60_000, 120_000, 240_000, 480_000, 900_000,
    ]);
    expect(nextPollDelay(60_000, 5)).toBe(900_000);
    expect(nextPollDelay(30_000, 50)).toBe(900_000);
  });

  it("ne descend jamais sous la cadence normale après le deuxième échec", () => {
    expect(nextPollDelay(2_000, 1)).toBe(2_000);
    expect(nextPollDelay(2_000, 2)).toBe(4_000);
    expect(nextPollDelay(1_800_000, 3)).toBe(1_800_000);
  });
});

describe("nextOrderPollDelay", () => {
  it("reste à 5 s quand la commande se charge", () => {
    expect(nextOrderPollDelay({ httpStatus: 200, everLoaded: true, failures: 0 })).toBe(5_000);
  });

  it("s'arrête définitivement sur 404, chargée ou non", () => {
    expect(nextOrderPollDelay({ httpStatus: 404, everLoaded: false, failures: 1 })).toBeNull();
    expect(nextOrderPollDelay({ httpStatus: 404, everLoaded: true, failures: 1 })).toBeNull();
  });

  it("401/403 sans chargement réussi : 3 essais à 5 s puis arrêt", () => {
    for (const httpStatus of [401, 403]) {
      expect(nextOrderPollDelay({ httpStatus, everLoaded: false, failures: 1 })).toBe(5_000);
      expect(nextOrderPollDelay({ httpStatus, everLoaded: false, failures: 2 })).toBe(5_000);
      expect(nextOrderPollDelay({ httpStatus, everLoaded: false, failures: 3 })).toBeNull();
    }
  });

  it("après un chargement réussi : jamais d'arrêt, backoff 5 → 10 → 20 → 40 → 60 s", () => {
    for (const httpStatus of [401, 403, 500, 0]) {
      expect(
        [1, 2, 3, 4, 5, 6, 40].map((failures) =>
          nextOrderPollDelay({ httpStatus, everLoaded: true, failures })
        )
      ).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000]);
    }
  });

  it("erreur réseau ou 5xx avant tout chargement : backoff sans arrêt", () => {
    expect(nextOrderPollDelay({ httpStatus: 0, everLoaded: false, failures: 3 })).toBe(20_000);
    expect(nextOrderPollDelay({ httpStatus: 503, everLoaded: false, failures: 9 })).toBe(60_000);
  });
});

describe("startVisiblePolling", () => {
  it("appelle tout de suite puis au délai renvoyé par tick", async () => {
    const tick = vi.fn(async () => 30_000);
    const stop = startVisiblePolling(tick);

    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(2);

    stop();
  });

  it("ne fait aucun appel onglet caché et reprend dès qu'il redevient visible", async () => {
    visibility = "hidden";
    const tick = vi.fn(async () => 30_000);
    const stop = startVisiblePolling(tick);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).not.toHaveBeenCalled();

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(2);

    stop();
  });

  it("reste single-flight quand la visibilité bascule pendant un appel en cours", async () => {
    const first = deferred<number | null>();
    const tick = vi
      .fn<() => Promise<number | null>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(async () => 30_000);
    const stop = startVisiblePolling(tick);

    setVisibility("hidden");
    setVisibility("visible");
    setVisibility("hidden");
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    first.resolve(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    // Une seule chaîne : exactement un appel par intervalle
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tick).toHaveBeenCalledTimes(3);

    stop();
  });

  it("au réveil : remet le backoff à zéro (onWake) et remplace le timer en attente", async () => {
    const onWake = vi.fn();
    const tick = vi.fn(async () => 900_000);
    const stop = startVisiblePolling(tick, { onWake, wakeOn: ["online"] });

    await vi.advanceTimersByTimeAsync(100_000);
    expect(tick).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onWake).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledTimes(2);

    // L'ancien timer (échéance à 900 s) a été annulé : rien avant 100 s + 900 s
    await vi.advanceTimersByTimeAsync(899_999);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(3);

    stop();
  });

  it("ignore les événements de réveil non demandés", async () => {
    const tick = vi.fn(async () => 30_000);
    const stop = startVisiblePolling(tick);

    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    stop();
  });

  it("s'arrête pour de bon quand tick renvoie null", async () => {
    const tick = vi.fn(async () => null);
    startVisiblePolling(tick, { wakeOn: ["focus", "online"] });

    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    setVisibility("visible");
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("stop() annule le timer, les listeners et la replanification d'un appel en cours", async () => {
    const pending = deferred<number | null>();
    const tick = vi.fn(() => pending.promise);
    const stop = startVisiblePolling(tick, { wakeOn: ["focus"] });

    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    stop();
    pending.resolve(1_000);
    setVisibility("hidden");
    setVisibility("visible");
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});

describe("useVisiblePolling", () => {
  it("ne fait rien tant que enabled est false, démarre quand il passe à true, s'arrête au démontage", async () => {
    const fn = vi.fn(async () => true);
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useVisiblePolling(fn, 30_000, enabled),
      { initialProps: { enabled: false } }
    );

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fn).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("échec (false ou exception) : nouvel essai à 5 s, puis backoff, puis retour à la cadence normale", async () => {
    const fn = vi
      .fn<() => Promise<boolean | void>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("réseau"))
      .mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useVisiblePolling(fn, 30_000));

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fn).toHaveBeenCalledTimes(4);

    unmount();
  });

  it("le retour sur l'onglet après des échecs relance tout de suite, sans attendre le backoff", async () => {
    const fn = vi.fn<() => Promise<boolean | void>>().mockResolvedValue(false);
    const { unmount } = renderHook(() => useVisiblePolling(fn, 30_000));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fn).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(3);

    // Compteur remis à zéro au réveil : cet échec est de nouveau un "premier" échec (5 s)
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fn).toHaveBeenCalledTimes(4);

    unmount();
  });
});
