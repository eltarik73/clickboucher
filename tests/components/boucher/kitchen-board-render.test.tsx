// Mode cuisine : rendu caractérisé du tableau. Un tableau fixe (une commande par colonne, deux
// commandes en historique) servi par un fetch simulé, à heure fixe en Europe/Paris, et le DOM
// sérialisé figé : un découpage de la page ne doit rien changer à ce qui s'affiche.
// jsdom n'applique pas le CSS : les deux mises en page (colonnes lg:, onglets mobiles) sont toujours
// dans le DOM. Le tableau entier est figé une fois ; ensuite, seul ce qui change : le panneau mobile
// de chaque onglet, puis le tiroir Historique du bureau.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import KitchenModePage from "@/app/(boucher)/boucher/commandes/page";
import type { KitchenHistoryOrder, KitchenOrder } from "@/hooks/use-order-polling";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const minutesFromNow = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000).toISOString();

function kitchenOrder(order: Partial<KitchenOrder> & Pick<KitchenOrder, "id" | "status">) {
  return {
    orderNumber: `KG26-${order.id}`,
    displayNumber: null,
    totalCents: 0,
    discountCents: 0,
    customerNumber: 12,
    isPro: false,
    customerNote: null,
    requestedTime: null,
    estimatedReady: null,
    actualReady: null,
    qrCode: null,
    paymentMethod: "ON_PICKUP",
    pickupSlotStart: null,
    createdAt: minutesFromNow(-30),
    updatedAt: minutesFromNow(-30),
    items: [],
    user: { firstName: "fatima", lastName: "amrani", phone: null, loyaltyBadge: null },
    priceAdjustment: null,
    ...order,
  } satisfies KitchenOrder;
}

/** A line of 500 g portions (KG), 200 g portions (TRANCHE) or pieces, its quantity as stored. */
function line(id: string, name: string, unit: "KG" | "PIECE" | "TRANCHE", quantity: number) {
  return {
    id,
    productId: `product-${id}`,
    name,
    quantity,
    unit,
    priceCents: 2990,
    totalCents: 2990,
    weightGrams: { KG: 500, TRANCHE: 200, PIECE: null }[unit],
    sliceCount: unit === "TRANCHE" ? 6 : null,
    sliceThickness: null,
    variant: null,
    pieceCount: null,
    pieceLabel: null,
    cutOption: null,
    available: true,
    product: { name, unit, imageUrl: null },
  } satisfies KitchenOrder["items"][number];
}

const ACTIVE = [
  kitchenOrder({
    id: "nouvelle",
    status: "PENDING",
    displayNumber: "#041",
    totalCents: 2990,
    createdAt: minutesFromNow(-3),
    updatedAt: minutesFromNow(-3),
    items: [line("n1", "Entrecôte", "KG", 1)],
  }),
  kitchenOrder({
    id: "en-cours",
    status: "PREPARING",
    displayNumber: "#042",
    totalCents: 1794,
    estimatedReady: minutesFromNow(12),
    items: [line("c1", "Merguez", "PIECE", 6)],
    user: { firstName: "karim", lastName: "benali", phone: "+33612345678", loyaltyBadge: null },
  }),
  kitchenOrder({
    id: "programmee",
    status: "ACCEPTED",
    displayNumber: "#043",
    totalCents: 4485,
    pickupSlotStart: minutesFromNow(180),
    estimatedReady: minutesFromNow(180),
    customerNote: "Bien emballer",
    items: [line("s1", "Gigot", "KG", 1.5)],
    user: { firstName: "sarah", lastName: "lemoine", phone: null, loyaltyBadge: "FIDELE" },
  }),
  kitchenOrder({
    id: "prete",
    status: "READY",
    displayNumber: "#044",
    totalCents: 1794,
    actualReady: minutesFromNow(-5),
    qrCode: "1a2b3c4d-0000-4000-8000-000000000000",
    items: [line("r1", "Escalope", "TRANCHE", 0.6)],
  }),
  kitchenOrder({
    id: "partielle",
    status: "PARTIALLY_DENIED",
    displayNumber: "#040",
    totalCents: 990,
    updatedAt: minutesFromNow(-20),
    items: [line("p1", "Poulet", "PIECE", 1)],
    user: { firstName: "ines", lastName: "tahar", phone: null, loyaltyBadge: null },
  }),
];

const HISTORY = [
  {
    id: "recuperee",
    orderNumber: "KG26-recuperee",
    displayNumber: "#039",
    status: "PICKED_UP",
    totalCents: 4485,
    updatedAt: minutesFromNow(-60),
    items: [{ quantity: 1.5, unit: "KG", weightGrams: 500 }],
    user: { firstName: "sarah", lastName: "lemoine" },
  },
] satisfies KitchenHistoryOrder[];

const SHOP = { name: "Boucherie Test", prepTimeMin: 20, status: "OPEN", pauseEndsAt: null };

function json(data: unknown) {
  return Response.json({ data });
}

function serve(url: string): Response {
  if (url === "/api/boucher/shop/status") return json(SHOP);
  if (url === "/api/boucher/orders/kitchen?history=1") {
    return json({ active: ACTIVE, activeTruncated: false, history: HISTORY });
  }
  if (url === "/api/boucher/orders/kitchen")
    return json({ active: ACTIVE, activeTruncated: false });
  throw new Error(`Unexpected fetch: ${url}`);
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function renderBoard() {
  const view = render(<KitchenModePage />);
  await flush();
  await flush();
  return view;
}

async function click(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
  await flush();
}

/** The single-column panel of the mobile and tablet layout (lg:hidden), below the tab bar. */
function mobilePanel(container: HTMLElement): Element {
  const panel = container.querySelector(".overflow-y-auto.lg\\:hidden");
  if (!panel) throw new Error("mobile panel not rendered");
  return panel;
}

function historyDrawer(): Element {
  const drawer = screen
    .getByRole("heading", { name: "Historique" })
    .closest('[role="presentation"]');
  if (!drawer) throw new Error("history drawer not rendered");
  return drawer;
}

beforeAll(() => {
  vi.stubEnv("TZ", "Europe/Paris");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => serve(url))
  );
  sessionStorage.setItem("audioUnlocked", "true");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("mode cuisine : rendu du tableau", () => {
  it("affiche les colonnes, l'en-cours scindé et chaque onglet mobile", async () => {
    const { container } = await renderBoard();
    expect(container).toMatchSnapshot("tableau");

    await click(/^Nouv\./);
    expect(mobilePanel(container)).toMatchSnapshot("onglet nouvelles");

    await click(/^Prêtes/);
    expect(mobilePanel(container)).toMatchSnapshot("onglet prêtes");
  });

  it("affiche l'historique dans l'onglet mobile et dans le tiroir du bureau", async () => {
    const { container } = await renderBoard();

    await click(/^Histo\./);
    expect(mobilePanel(container)).toMatchSnapshot("onglet historique");

    await click(/^Historique/);
    expect(historyDrawer()).toMatchSnapshot("tiroir historique");
  });

  it("compte les articles d'une commande terminée comme sa carte, et nomme son statut", async () => {
    const { container } = await renderBoard();
    // The scheduled card counts its 1.5 kg line (3 × 500 g) as 3 articles.
    expect(container.textContent).toContain("3 articles44,85 €");

    await click(/^Historique/);
    expect(historyDrawer().textContent).toContain("#039Sarah.LRécupérée44,85 €3 articles");
    expect(historyDrawer().textContent).toContain("#040Ines.TPartiel. refusée9,90 €1 article");
  });
});
