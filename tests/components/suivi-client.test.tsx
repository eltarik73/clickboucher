// Page de suivi /suivi/[id] (SuiviClient) branchée sur useOrderTracker : rien au montage, puis le
// statut, la marge de pesée et l'ajustement en attente suivent la commande relue, sans recharger.
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import type { OrderStatus } from "@prisma/client";
import SuiviClient from "@/app/(client)/suivi/[id]/SuiviClient";
import { fetchMock, serve, serveOrder, trackedOrder } from "./order-tracking-fixtures";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
// Next's Link only prefetches with an app router mounted: the prop is what the page decides.
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

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

  it("la marge de pesée sous le total suit l'estimation relue (une ligne retirée entre-temps)", async () => {
    const later = { estimatedTotalCents: 2000, updatedAt: "2026-11-14T12:31:00.000Z" };
    serve(200, { success: true, data: { ...trackedOrder("PREPARING"), ...later } });
    render(<SuiviClient order={pageOrder("PREPARING")} />);
    expect(
      screen.getByText(
        "Marge de pesée acceptée : 10 % du total estimé, 20,00 € au plus, soit jusqu'à 2,45 € sur cette commande."
      )
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText(/soit jusqu'à 2,00 € sur cette commande\.$/)).toBeInTheDocument();
  });

  it("ajustement sans réponse à l'échéance : la page relit la commande, sans attendre la sonde", async () => {
    serveOrder("PREPARING");
    const adjustment = {
      id: "adj_1",
      originalTotal: 2450,
      newTotal: 2700,
      reason: null,
      adjustmentType: "WEIGHT",
      status: "PENDING" as const,
      closeReason: null,
      answerBy: new Date(Date.now() + 2_000).toISOString(),
      createdAt: new Date(Date.now() - 298_000).toISOString(),
    };
    render(<SuiviClient order={{ ...pageOrder("PREPARING"), priceAdjustment: adjustment }} />);
    expect(screen.getByRole("button", { name: "Accepter" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/ord_1/status", { cache: "no-store" });
    expect(screen.queryByRole("button", { name: "Accepter" })).toBeNull();
  });

  it("une commande dont un article manque mène au choix d'un remplacement", () => {
    render(<SuiviClient order={pageOrder("PARTIALLY_DENIED")} />);
    expect(screen.getByText("Un article n'est plus disponible")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Choisir un remplacement" });
    expect(link).toHaveAttribute("href", "/commande/ord_1");
    expect(link).toHaveClass("h-12", "w-full");
  });
});
