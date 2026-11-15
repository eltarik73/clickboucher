// Bouton « Annuler la commande » de la page de suivi : visible selon isCancellable (décidé après le
// montage), masqué à la fin des 5 minutes, confirmation dans un alertdialog, un seul POST, réponse du
// serveur relayée (commande annulée ou message de refus).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import type { OrderStatus } from "@prisma/client";
import CancelOrderButton from "@/app/(client)/suivi/[id]/CancelOrderButton";
import SuiviClient from "@/app/(client)/suivi/[id]/SuiviClient";
import type { TrackedOrder } from "@/hooks/useOrderTracker";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const MINUTE = 60_000;

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function cancelledOrder(): TrackedOrder {
  return {
    id: "ord_1",
    status: "CANCELLED",
    displayNumber: "#12",
    totalCents: 2450,
    weighToleranceRateBps: null,
    weighToleranceCapCents: null,
    estimatedTotalCents: null,
    boucherNote: null,
    estimatedReady: null,
    actualReady: null,
    pickedUpAt: null,
    createdAt: "2026-11-14T12:00:00.000Z",
    updatedAt: "2026-11-14T12:01:00.000Z",
    items: [],
    priceAdjustment: null,
  };
}

function renderButton(status: OrderStatus, ageMs: number) {
  const onCancelled = vi.fn<(order: TrackedOrder) => void>();
  const createdAt = new Date(Date.now() - ageMs).toISOString();
  const view = render(
    <CancelOrderButton
      orderId="ord_1"
      status={status}
      createdAt={createdAt}
      onCancelled={onCancelled}
    />
  );
  const rerenderWith = (next: OrderStatus) =>
    view.rerender(
      <CancelOrderButton
        orderId="ord_1"
        status={next}
        createdAt={createdAt}
        onCancelled={onCancelled}
      />
    );
  return { onCancelled, rerenderWith };
}

function trigger() {
  return screen.queryByRole("button", { name: "Annuler la commande" });
}

async function confirmCancel() {
  fireEvent.click(trigger() as HTMLElement);
  const dialog = await screen.findByRole("alertdialog", { name: "Annuler la commande ?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Oui, annuler" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  toast.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CancelOrderButton : visibilité", () => {
  it("visible pour une commande en attente, quel que soit son âge", () => {
    renderButton("PENDING", 60 * MINUTE);
    expect(trigger()).toBeInTheDocument();
  });

  it("visible pour une commande acceptée il y a 1 minute", () => {
    renderButton("ACCEPTED", MINUTE);
    expect(trigger()).toBeInTheDocument();
  });

  it("masqué pour une commande acceptée il y a 6 minutes", () => {
    renderButton("ACCEPTED", 6 * MINUTE);
    expect(trigger()).toBeNull();
  });

  it.each<OrderStatus>(["PREPARING", "READY", "PARTIALLY_DENIED", "CANCELLED"])(
    "masqué pour le statut %s",
    (status) => {
      renderButton(status, MINUTE);
      expect(trigger()).toBeNull();
    }
  );

  it("se masque de lui-même à la fin des 5 minutes", () => {
    vi.useFakeTimers();
    renderButton("ACCEPTED", 4 * MINUTE);
    expect(trigger()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MINUTE - 1);
    });
    expect(trigger()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(trigger()).toBeNull();
  });

  it("une confirmation ouverte reste jusqu'à la réponse du client quand la fenêtre se ferme", () => {
    vi.useFakeTimers();
    renderButton("ACCEPTED", 5 * MINUTE - 1_000);
    fireEvent.click(trigger() as HTMLElement);
    expect(screen.getByRole("alertdialog", { name: "Annuler la commande ?" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const dialog = screen.getByRole("alertdialog", { name: "Annuler la commande ?" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Garder ma commande" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(trigger()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("suit le statut affiché", () => {
    const { rerenderWith } = renderButton("PENDING", MINUTE);
    expect(trigger()).toBeInTheDocument();
    rerenderWith("PREPARING");
    expect(trigger()).toBeNull();
  });

  it("n'appelle rien au montage, cible tactile pleine largeur", () => {
    renderButton("PENDING", MINUTE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trigger()).toHaveClass("w-full", "h-12");
  });
});

describe("CancelOrderButton : confirmation et envoi", () => {
  it("ouvre un alertdialog titré, focus sur « Garder ma commande »", async () => {
    renderButton("PENDING", MINUTE);
    fireEvent.click(trigger() as HTMLElement);

    const dialog = await screen.findByRole("alertdialog", { name: "Annuler la commande ?" });
    expect(dialog).toHaveAccessibleDescription(
      "La boucherie sera prévenue. Vous ne pourrez pas revenir en arrière."
    );
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Garder ma commande" })
    );
  });

  it("« Garder ma commande » ferme sans rien envoyer", async () => {
    renderButton("PENDING", MINUTE);
    fireEvent.click(trigger() as HTMLElement);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Garder ma commande" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("confirmer envoie un seul POST sans corps et transmet la commande annulée", async () => {
    fetchMock.mockResolvedValue(reply(200, { success: true, data: cancelledOrder() }));
    const { onCancelled } = renderButton("PENDING", MINUTE);

    await confirmCancel();

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(cancelledOrder()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/ord_1/cancel", { method: "POST" });
    expect(toast.success).toHaveBeenCalledWith("Commande annulée");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("désactive le bouton pendant la requête", async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        })
    );
    renderButton("PENDING", MINUTE);

    await confirmCancel();
    await waitFor(() => expect(trigger()).toBeDisabled());
    expect(trigger()).toHaveAttribute("aria-busy", "true");

    answer(reply(409, { success: false, error: { code: "CONFLICT", message: "Refus" } }));
    await waitFor(() => expect(trigger()).not.toBeDisabled());
  });

  it("un 409 affiche le message du serveur", async () => {
    const message = "Cette commande a changé d'état entre-temps (statut actuel : En préparation).";
    fetchMock.mockResolvedValue(
      reply(409, { success: false, error: { code: "CONFLICT", message } })
    );
    const { onCancelled } = renderButton("ACCEPTED", MINUTE);

    await confirmCancel();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(onCancelled).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("un refus sans message donne le message générique", async () => {
    fetchMock.mockResolvedValue(reply(502, null));
    renderButton("PENDING", MINUTE);

    await confirmCancel();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Impossible d'annuler la commande")
    );
  });

  it("une erreur réseau le dit", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { onCancelled } = renderButton("PENDING", MINUTE);

    await confirmCancel();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erreur réseau, réessayez"));
    expect(onCancelled).not.toHaveBeenCalled();
  });
});

describe("annulation depuis la page de suivi", () => {
  it("le statut affiché devient « annulée », le bouton disparaît, un seul toast", async () => {
    fetchMock.mockResolvedValue(reply(200, { success: true, data: cancelledOrder() }));
    render(
      <SuiviClient
        order={{
          ...cancelledOrder(),
          status: "PENDING",
          updatedAt: "2026-11-14T12:00:00.000Z",
          displayNumber: "#12",
          orderNumber: "KG26-000012",
          customerNumber: null,
          customerNote: null,
          shop: {
            id: "shop_1",
            name: "Boucherie Test",
            address: "1 rue A",
            city: "Chambéry",
            phone: "",
          },
          user: { firstName: "Tarik", lastName: "Benali" },
        }}
      />
    );

    await confirmCancel();

    const badge = screen.getByRole("status", { name: "Statut de la commande" });
    await waitFor(() => expect(badge).toHaveTextContent("Commande annulée"));
    expect(trigger()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
});
