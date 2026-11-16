// La question posée au client quand son boucher propose un nouveau prix hors de sa marge de pesée :
// accepter ou refuser, avant une échéance réelle (answerBy), et sans réponse le prix ne change pas.
// Puis le texte de chaque issue, ancienne ligne comprise ; aucun mot de l'ancienne règle.
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PriceAdjustmentBanner, {
  type PriceAdjustmentView,
} from "@/components/client/PriceAdjustmentBanner";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const NOW = new Date("2026-11-15T12:00:00.000Z");
const NO_ANSWER_LINE = "Sans réponse de votre part dans ce délai, le prix ne change pas.";
const TIER_WORDS = /automatiquement|palier/i;

function adjustment(overrides: Partial<PriceAdjustmentView> = {}): PriceAdjustmentView {
  return {
    id: "adj_1",
    originalTotal: 2000,
    newTotal: 2150,
    reason: "Pièce plus lourde",
    status: "PENDING",
    closeReason: null,
    answerBy: "2026-11-15T12:04:30.000Z",
    createdAt: "2026-11-15T11:59:30.000Z",
    ...overrides,
  };
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function show(view: PriceAdjustmentView, onUpdate = vi.fn()) {
  const utils = render(
    <PriceAdjustmentBanner orderId="ord_1" adjustment={view} onUpdate={onUpdate} />
  );
  return { onUpdate, ...utils };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fetchMock.mockReset();
  toast.success.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PriceAdjustmentBanner : prix proposé, en attente de la réponse du client", () => {
  it("anciens et nouveau totaux, différence, motif, les deux réponses et la règle du silence", () => {
    const { container } = show(adjustment());

    expect(
      screen.getByRole("heading", { name: "Votre boucher propose un nouveau prix" })
    ).toBeInTheDocument();
    expect(screen.getByText("20,00 €")).toBeInTheDocument();
    expect(screen.getByText("21,50 €")).toBeInTheDocument();
    expect(screen.getByText("+1,50 €")).toBeInTheDocument();
    expect(screen.getByText("Motif : Pièce plus lourde")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refuser" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Accepter" })).toBeEnabled();
    expect(screen.getByText(NO_ANSWER_LINE)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(TIER_WORDS);
  });

  it("rendu serveur : aucune horloge lue, donc pas de décompte", () => {
    const html = renderToString(
      <PriceAdjustmentBanner orderId="ord_1" adjustment={adjustment()} onUpdate={() => {}} />
    );
    expect(html).toContain("Sans réponse de votre part dans ce délai");
    expect(html).not.toMatch(/\d+:\d\d/);
  });

  it("après le montage : décompte jusqu'à answerBy, une seconde à la fois", () => {
    show(adjustment());
    expect(screen.getByRole("timer")).toHaveTextContent("4:30");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("4:29");
  });

  it("ancienne ligne sans answerBy : l'échéance est la création plus 5 minutes", () => {
    show(adjustment({ answerBy: null, createdAt: "2026-11-15T11:58:00.000Z" }));
    expect(screen.getByRole("timer")).toHaveTextContent("3:00");
  });

  it("à zéro : le délai est dépassé, plus de réponse possible, la page relit la commande une fois", () => {
    const { onUpdate } = show(adjustment({ answerBy: "2026-11-15T12:00:02.000Z" }));
    expect(onUpdate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(
      screen.getByText("Délai dépassé : le prix de votre commande n'a pas changé.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accepter" })).toBeNull();
    expect(onUpdate).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("le démontage arrête le décompte", () => {
    const { onUpdate, unmount } = show(adjustment({ answerBy: "2026-11-15T12:00:02.000Z" }));
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("Accepter : envoie la réponse, bloque les deux boutons pendant l'envoi, puis relit la commande", async () => {
    let answer: (response: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { onUpdate } = show(adjustment());

    fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/ord_1/adjustment/accept", {
      method: "POST",
    });
    expect(screen.getByRole("button", { name: "Accepter" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refuser" })).toBeDisabled();

    await act(async () => {
      answer(reply(200, { success: true, data: {} }));
    });
    expect(toast.success).toHaveBeenCalledWith("Nouveau prix accepté");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("Refuser : la réponse va à la route de refus", async () => {
    fetchMock.mockResolvedValue(reply(200, { success: true, data: {} }));
    const { onUpdate } = show(adjustment());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refuser" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/ord_1/adjustment/reject", {
      method: "POST",
    });
    expect(toast.success).toHaveBeenCalledWith("Nouveau prix refusé : le prix ne change pas");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("refus du serveur : son message s'affiche, et la page relit l'état réel", async () => {
    const message = "Le délai de réponse est dépassé : le prix de votre commande n'a pas changé.";
    fetchMock.mockResolvedValue(
      reply(409, { success: false, error: { code: "CONFLICT", message } })
    );
    const { onUpdate } = show(adjustment());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("200 sans l'enveloppe de succès : la réponse n'est pas tenue pour enregistrée", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: {} }));
    show(adjustment());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Votre réponse n'a pas été enregistrée. Réessayez."
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("panne réseau : un message, les boutons reviennent", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { onUpdate } = show(adjustment());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Erreur réseau : votre réponse n'est pas partie. Réessayez."
    );
    expect(screen.getByRole("button", { name: "Accepter" })).toBeEnabled();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("PriceAdjustmentBanner : issue de l'ajustement", () => {
  const outcomes: Array<[string, Partial<PriceAdjustmentView>, string]> = [
    [
      "baisse appliquée",
      { status: "AUTO_APPROVED", newTotal: 1850 },
      "Bonne nouvelle : le prix a baissé",
    ],
    [
      "hausse dans la marge",
      { status: "AUTO_APPROVED" },
      "Prix ajusté après la pesée, dans la marge que vous avez choisie",
    ],
    ["acceptée par le client", { status: "APPROVED" }, "Nouveau prix accepté"],
    [
      "refusée par le client",
      { status: "REJECTED", closeReason: "CUSTOMER_REFUSED" },
      "Vous avez refusé le nouveau prix : le prix de votre commande n'a pas changé.",
    ],
    [
      "sans réponse",
      { status: "REJECTED", closeReason: "NO_ANSWER" },
      "Délai dépassé : le prix de votre commande n'a pas changé.",
    ],
    [
      "commande changée entre-temps",
      { status: "REJECTED", closeReason: "ORDER_CHANGED" },
      "Ajustement non appliqué : le prix n'a pas changé.",
    ],
    [
      "ancien refus sans motif",
      { status: "REJECTED", closeReason: null },
      "Ajustement non appliqué : le prix n'a pas changé.",
    ],
    ["ancienne validation sans réponse", { status: "AUTO_VALIDATED" }, "Prix ajusté"],
    [
      "ancienne escalade",
      { status: "ESCALATED" },
      "Ajustement non appliqué : le prix n'a pas changé.",
    ],
  ];

  it.each(outcomes)("%s", (_label, overrides, text) => {
    const { container, onUpdate } = show(adjustment(overrides));

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(container.textContent).not.toMatch(TIER_WORDS);
    act(() => {
      vi.advanceTimersByTime(600_000);
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("un prix appliqué montre l'ancien et le nouveau total", () => {
    show(adjustment({ status: "AUTO_APPROVED", newTotal: 1850 }));
    expect(screen.getByText("20,00 € → 18,50 €")).toBeInTheDocument();
  });
});
