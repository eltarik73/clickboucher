// Suivi en direct de /suivi/[id] (useOrderTracker) : rien au montage (le serveur vient de rendre la
// commande), une lecture toutes les 5 s onglet visible, arrêt sur commande terminée ou introuvable,
// backoff sur erreur, et jamais d'erreur à la place de la commande affichée.
import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import type { OrderStatus } from "@prisma/client";
import EstimatedCountdown from "@/app/(client)/suivi/[id]/EstimatedCountdown";
import SuiviClient from "@/app/(client)/suivi/[id]/SuiviClient";
import { useOrderTracker, type TrackedOrder } from "@/hooks/useOrderTracker";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
// Next's Link only prefetches with an app router mounted: the prop is what the page decides.
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

function trackedOrder(status: OrderStatus): TrackedOrder {
  return {
    id: "ord_1",
    status,
    displayNumber: "#12",
    totalCents: 2450,
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

/** Réponse minimale : la lecture du corps ne dépend pas des minuteurs simulés. */
function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function serve(status: number, body: unknown) {
  fetchMock.mockImplementation(async () => reply(status, body));
}

function serveOrder(status: OrderStatus) {
  serve(200, { success: true, data: trackedOrder(status) });
}

function track(status: OrderStatus = "PENDING") {
  const onUpdate = vi.fn<(order: TrackedOrder) => void>();
  const hook = renderHook(
    (props: { status: OrderStatus }) =>
      useOrderTracker({ orderId: "ord_1", status: props.status, onUpdate }),
    { initialProps: { status } }
  );
  return { onUpdate, ...hook };
}

/** The props the server page gives the tracking page for this order. */
function pageOrder(status: OrderStatus): ComponentProps<typeof SuiviClient>["order"] {
  return {
    ...trackedOrder(status),
    displayNumber: "#12",
    orderNumber: "KG26-000012",
    customerNumber: null,
    customerNote: null,
    shop: { id: "shop_1", name: "Boucherie Test", address: "1 rue A", city: "Chambéry", phone: "" },
    user: { firstName: "Tarik", lastName: "Benali" },
  };
}

function statusBadge() {
  return screen.getByRole("status", { name: "Statut de la commande" });
}

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  fetchMock.mockReset();
  toast.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useOrderTracker", () => {
  it("n'appelle rien au montage, puis lit la route de statut au bout de 5 s", async () => {
    serveOrder("PENDING");
    const { unmount } = track();

    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/orders/ord_1/status");

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("transmet chaque lecture réussie", async () => {
    serveOrder("READY");
    const { onUpdate, unmount } = track("PREPARING");

    await vi.advanceTimersByTimeAsync(5_000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(trackedOrder("READY"));
    unmount();
  });

  it.each<OrderStatus>(["PICKED_UP", "COMPLETED", "DENIED", "CANCELLED", "AUTO_CANCELLED"])(
    "s'arrête quand la commande lue est terminée (%s)",
    async (status) => {
      serveOrder(status);
      const { onUpdate } = track("READY");

      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(trackedOrder(status));

      setVisibility("hidden");
      setVisibility("visible");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(600_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("s'arrête sur 404 sans rien transmettre", async () => {
    serve(404, { success: false, error: { code: "NOT_FOUND", message: "Commande introuvable" } });
    const { onUpdate } = track();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("recule après un 500 (5, 10, 20 s) sans rien transmettre, et reprend sa cadence au premier succès", async () => {
    serve(500, { success: false, error: { code: "INTERNAL_ERROR", message: "Erreur" } });
    const { onUpdate, unmount } = track();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onUpdate).not.toHaveBeenCalled();

    serveOrder("ACCEPTED");
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    unmount();
  });

  it("une erreur réseau ou un corps illisible ne transmet rien", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(reply(200, { success: false }));
    const { onUpdate, unmount } = track();

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUpdate).not.toHaveBeenCalled();
    unmount();
  });

  it("n'appelle rien onglet caché, puis lit tout de suite quand il redevient visible", async () => {
    serveOrder("ACCEPTED");
    visibility = "hidden";
    const { onUpdate, unmount } = track();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).not.toHaveBeenCalled();

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("le focus et le retour du réseau lisent tout de suite", async () => {
    serveOrder("ACCEPTED");
    const { unmount } = track();

    await vi.advanceTimersByTimeAsync(1_000);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // La lecture du réveil remplace le minuteur en attente : prochaine lecture 5 s après elle.
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("refresh() lit tout de suite et transmet la commande", async () => {
    serveOrder("ACCEPTED");
    const { result, onUpdate, unmount } = track();

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(trackedOrder("ACCEPTED"));
    unmount();
  });

  it("garde la même fonction refresh d'un rendu à l'autre", () => {
    const { result, rerender, unmount } = track();
    const first = result.current.refresh;
    rerender({ status: "ACCEPTED" });
    expect(result.current.refresh).toBe(first);
    unmount();
  });

  it("ne suit pas une commande déjà terminée à l'affichage", async () => {
    serveOrder("PICKED_UP");
    const { result, onUpdate } = track("PICKED_UP");

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("s'arrête quand la commande affichée devient terminée (annulée sur la page)", async () => {
    serveOrder("PENDING");
    const { rerender } = track("PENDING");

    rerender({ status: "CANCELLED" });
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("page de suivi (SuiviClient) branchée sur useOrderTracker", () => {
  it("affiche « prête » une période après que la boucherie l'a marquée prête, sans recharger", async () => {
    serveOrder("READY");
    render(<SuiviClient order={pageOrder("PREPARING")} />);
    expect(statusBadge()).toHaveTextContent("En préparation");
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(statusBadge()).toHaveTextContent("Commande prête !");
    expect(toast).toHaveBeenCalledWith("Commande prête — venez la chercher !", { icon: "🎉" });
  });

  it("une lecture plus ancienne que la commande affichée ne la remplace pas", async () => {
    serve(200, {
      success: true,
      data: { ...trackedOrder("ACCEPTED"), updatedAt: "2026-11-14T12:29:00.000Z" },
    });
    render(<SuiviClient order={pageOrder("PREPARING")} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(statusBadge()).toHaveTextContent("En préparation");
    expect(toast).not.toHaveBeenCalled();
  });

  it("le lien retour vers « Mes commandes » ne précharge pas cette route protégée", () => {
    render(<SuiviClient order={pageOrder("PREPARING")} />);
    const back = screen.getByRole("link", { name: "Mes commandes" });
    expect(back).toHaveAttribute("href", "/commandes");
    expect(back).toHaveAttribute("data-prefetch", "false");
  });

  it("une commande dont un article manque mène au choix d'un remplacement", () => {
    render(<SuiviClient order={pageOrder("PARTIALLY_DENIED")} />);
    expect(screen.getByText("Un article n'est plus disponible")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Choisir un remplacement" });
    expect(link).toHaveAttribute("href", "/commande/ord_1");
    expect(link).toHaveClass("h-12", "w-full");
  });
});

describe("EstimatedCountdown : l'horloge n'est lue qu'après le montage", () => {
  // 13:10:30 à Paris (UTC+1 en novembre), 10 min 30 s après l'heure simulée.
  const READY_AT = "2026-11-14T12:10:30.000Z";
  const COUNTDOWN = /\d+ ?min|\d+s\b|Prête dans|dépassé/;

  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-14T12:00:00.000Z"));
  });

  it("rendu serveur : l'heure de retrait seule, sans décompte ni verdict « en retard »", () => {
    const html = renderToString(<EstimatedCountdown estimatedReady={READY_AT} />);
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Retrait estimé : 13:10");
    expect(text).not.toMatch(COUNTDOWN);
  });

  it("après le montage : le décompte apparaît puis avance chaque seconde", () => {
    render(<EstimatedCountdown estimatedReady={READY_AT} />);
    expect(screen.getByText("Prête dans environ")).toBeInTheDocument();
    expect(screen.getByText("10 min 30s")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("10 min 29s")).toBeInTheDocument();
    expect(screen.getByText("Retrait estimé : 13:10")).toBeInTheDocument();
  });
});
