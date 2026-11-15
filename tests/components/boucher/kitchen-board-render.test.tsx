// Mode cuisine : rendu caractérisé du tableau (fetch simulé, heure fixe en Europe/Paris, DOM figé) ;
// un découpage de la page ne doit rien changer à ce qui s'affiche. jsdom n'applique pas le CSS : les
// deux mises en page (colonnes lg:, onglets mobiles) sont toujours dans le DOM. Le tableau entier est
// figé une fois, puis seul ce qui change ; un changement d'état de la boutique, par sa requête.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KitchenModePage from "@/app/(boucher)/boucher/commandes/page";
import type { KitchenHistoryOrder, KitchenOrder } from "@/hooks/use-order-polling";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

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
let shop: { status: string; pauseEndsAt: string | null } = SHOP;

function json(data: unknown) {
  return Response.json({ data });
}

function serve(url: string): Response {
  if (url === "/api/boucher/shop/status") return json({ ...SHOP, ...shop });
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

/** Every request sent to the shop status route, in order: "GET" or the PATCH body. */
function shopStatusRequests(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/boucher/shop/status")
    .map(([, init]) => (init?.method === "PATCH" ? String(init.body) : "GET"));
}

/** The modal or drawer titled `heading`, backdrop included. */
function overlay(heading: string): Element {
  const element = screen.getByRole("heading", { name: heading }).closest('[role="presentation"]');
  if (!element) throw new Error(`${heading} not rendered`);
  return element;
}

beforeEach(() => {
  vi.stubEnv("TZ", "Europe/Paris");
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  shop = SHOP;
  vi.clearAllMocks();
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
  vi.unstubAllEnvs();
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

  it("réunit En cours et Prêtes dans la seconde colonne du bureau en mode simple", async () => {
    localStorage.setItem("klikgo-simple-mode", "true");
    const { container } = await renderBoard();
    const columns = [...container.querySelector(".pb-14.lg\\:flex")!.children];
    const header = (column: Element) => column.querySelector("h2")?.parentElement?.textContent;

    expect(columns.map((column) => [column.className, header(column)])).toEqual([
      ["w-[50%] shrink-0", "Nouvelles1"],
      ["w-[50%] shrink-0", "En cours / Prêtes3"],
    ]);
    expect(columns[1].textContent).toMatch(/#042.*#043.*#044/);
  });

  it("affiche l'historique dans l'onglet mobile et dans le tiroir du bureau", async () => {
    const { container } = await renderBoard();

    await click(/^Histo\./);
    expect(mobilePanel(container)).toMatchSnapshot("onglet historique");

    await click(/^Historique/);
    expect(overlay("Historique")).toMatchSnapshot("tiroir historique");
  });

  it("compte les articles d'une commande terminée comme sa carte, et nomme son statut", async () => {
    const { container } = await renderBoard();
    // The scheduled card counts its 1.5 kg line (3 × 500 g) as 3 articles.
    expect(container.textContent).toContain("3 articles44,85 €");

    await click(/^Historique/);
    const drawer = overlay("Historique").textContent;
    expect(drawer).toContain("#039Sarah.LRécupérée44,85 €3 articles");
    expect(drawer).toContain("#040Ines.TPartiel. refusée9,90 €1 article");
  });
});

describe("mode cuisine : état de la boutique", () => {
  it("suspend pour la durée choisie, relit l'état et ferme la fenêtre", async () => {
    await renderBoard();
    await click(/^Pause$/);
    await click(/^30/);
    expect(overlay("Suspendre les commandes")).toMatchSnapshot("fenêtre pause, 30 min");
    await click(/^Suspendre pendant 30 min$/);
    await flush();

    const pause = '{"action":"pause","reason":"Pause manuelle","durationMin":30}';
    expect(shopStatusRequests()).toEqual(["GET", pause, "GET"]);
    expect(toast.success).toHaveBeenCalledWith("Pause 30 min");
    expect(screen.queryByRole("heading", { name: "Suspendre les commandes" })).toBeNull();
  });

  it("met la boutique hors ligne depuis l'interrupteur", async () => {
    const { container } = await renderBoard();
    // The online toggle is the only header button styled inline (its colour follows the status)
    fireEvent.click(container.querySelector("header button[style]")!);
    await flush();
    await flush();

    expect(shopStatusRequests()).toEqual(["GET", '{"action":"close"}', "GET"]);
    expect(toast.success).toHaveBeenCalledWith("Boutique hors ligne");
  });

  it("compte la pause à rebours et reprend depuis le bandeau puis depuis la barre", async () => {
    shop = { status: "PAUSED", pauseEndsAt: minutesFromNow(10) };
    const { container } = await renderBoard();
    expect(container.textContent).toContain("Commandes suspendues — reprise dans 10:00");
    // Logo and right-hand icons do not depend on the pause: the « tableau » snapshot covers them
    expect(container.querySelector("header")!.children[1]).toMatchSnapshot("contrôles en pause");
    const banner = screen.getByText(/^Commandes suspendues/).parentElement;
    expect(banner).toMatchSnapshot("bandeau pause");

    await click(/^Reprendre$/);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /10:00/ }));
    await flush();
    await flush();

    const resume = '{"action":"resume"}';
    expect(shopStatusRequests()).toEqual(["GET", resume, "GET", resume, "GET"]);
    expect(toast.success).toHaveBeenNthCalledWith(1, "Boutique en ligne");
    expect(toast.success).toHaveBeenNthCalledWith(2, "Boutique en ligne");
  });
});
