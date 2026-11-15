// Mode cuisine : écritures de commande. Le corps part tel quel ; une action acceptée relit le tableau
// puis l'annonce, une action refusée le relit et affiche la phrase de l'API (ou le repli de l'écran).
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stopOrderAlert } from "@/lib/sounds";
import { useOrderActions } from "../use-order-actions";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/sounds", () => ({ stopOrderAlert: vi.fn() }));

const refetch = vi.fn(async () => undefined);
const JSON_PATCH = { method: "PATCH", headers: { "Content-Type": "application/json" } };

function answer(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response)
  );
}

function refusal(status: number, message: string) {
  return Response.json({ success: false, error: { code: "CONFLICT", message } }, { status });
}

let actions: () => ReturnType<typeof useOrderActions>;

beforeEach(() => {
  vi.clearAllMocks();
  const { result } = renderHook(() => useOrderActions(refetch));
  actions = () => result.current;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useOrderActions", () => {
  it("envoie l'action telle quelle, coupe la sonnerie, relit le tableau puis l'annonce", async () => {
    answer(Response.json({ success: true, data: {} }));

    await act(() => actions().handleAction("o-1", { action: "accept", estimatedMinutes: 20 }));

    expect(fetch).toHaveBeenCalledWith("/api/boucher/orders/o-1/action", {
      ...JSON_PATCH,
      body: '{"action":"accept","estimatedMinutes":20}',
    });
    expect(stopOrderAlert).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Commande acceptee");
    expect(vi.mocked(refetch).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(toast.success).mock.invocationCallOrder[0]
    );
  });

  it("relit le tableau et affiche la phrase de l'API, ou le repli sans phrase", async () => {
    answer(refusal(409, "Cette commande a déjà été acceptée"));
    await act(() => actions().handleAction("o-1", { action: "mark_ready" }));
    expect(toast.error).toHaveBeenLastCalledWith("Cette commande a déjà été acceptée");
    expect(refetch).toHaveBeenCalledOnce();
    expect(stopOrderAlert).not.toHaveBeenCalled();

    answer(new Response("<html>Bad Gateway</html>", { status: 502 }));
    await act(() => actions().handleAction("o-1", { action: "mark_ready" }));
    expect(toast.error).toHaveBeenLastCalledWith("Erreur lors de l'action");
  });

  it("envoie l'ajustement de prix tel quel et annonce une baisse appliquée", async () => {
    answer(Response.json({ success: true, data: { autoApproved: true } }));
    const data = { items: [{ itemId: "i-1", newWeightGrams: 450 }], reason: "Poids réel" };

    await act(() => actions().handleAdjustPrice("o-1", data));

    expect(fetch).toHaveBeenCalledWith("/api/orders/o-1/adjust-price", {
      ...JSON_PATCH,
      body: JSON.stringify(data),
    });
    expect(refetch).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Prix ajusté automatiquement (baisse)");
  });

  it("affiche le refus d'un ajustement sans relire, et signale une coupure réseau", async () => {
    answer(refusal(400, "Le nouveau poids est hors limite"));
    await act(() => actions().handleAdjustPrice("o-1", {}));
    expect(toast.error).toHaveBeenLastCalledWith("Le nouveau poids est hors limite");
    expect(refetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(() => actions().handleAction("o-1", { action: "manual_pickup" }));
    expect(toast.error).toHaveBeenLastCalledWith("Erreur de connexion au serveur");
  });
});
