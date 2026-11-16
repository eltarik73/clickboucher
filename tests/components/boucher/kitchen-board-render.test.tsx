// Mode cuisine (fetch simulé, heure fixe en Europe/Paris) : ce que liste chaque colonne, onglet et
// tiroir, dans l'ordre, les libellés qui comptent, et chaque changement d'état de la boutique par sa
// requête. jsdom n'applique pas le CSS : colonnes lg: et onglets mobiles sont tous dans le DOM.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KitchenModePage from "@/app/(boucher)/boucher/commandes/page";
import { kitchenLine } from "@/components/boucher/__tests__/kitchen-order-fixtures";
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
    weighToleranceRateBps: null,
    weighToleranceCapCents: null,
    estimatedTotalCents: null,
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
  return kitchenLine({
    id,
    name,
    unit,
    quantity,
    priceCents: 2990,
    totalCents: 2990,
    estimatedPriceCents: null,
    weightGrams: { KG: 500, TRANCHE: 200, PIECE: null }[unit],
    sliceCount: unit === "TRANCHE" ? 6 : null,
  });
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

function serve(url: string): Response {
  if (url === "/api/boucher/shop/status") return Response.json({ data: { ...SHOP, ...shop } });
  const board = { active: ACTIVE, activeTruncated: false };
  if (url === "/api/boucher/orders/kitchen") return Response.json({ data: board });
  if (url === "/api/boucher/orders/kitchen?history=1") {
    return Response.json({ data: { ...board, history: HISTORY } });
  }
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
  const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/boucher/shop/status");
  return calls.map(([, init]) => (init?.method === "PATCH" ? String(init.body) : "GET"));
}

/** Section titles and order numbers listed by `element`, in reading order. */
function outline(element: Element): string[] {
  return element.textContent?.match(/#\d{3}|À PRÉPARER MAINTENANT|PRÉCOMMANDES/g) ?? [];
}

const IN_PROGRESS = ["À PRÉPARER MAINTENANT", "#042", "PRÉCOMMANDES", "#043"];

/** The modal or drawer titled `heading`, backdrop included. */
function overlay(heading: string): HTMLElement {
  const title = screen.getByRole("heading", { name: heading });
  return title.closest<HTMLElement>('[role="presentation"]')!;
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
    const columns = [...container.querySelector(".pb-14.lg\\:flex")!.children];
    const titles = screen.getAllByRole("heading", { level: 2 }).map((title) => title.textContent);

    expect(titles).toEqual(["Nouvelles", "En cours", "Prêtes"]);
    expect(columns.map(outline)).toEqual([["#041"], [], IN_PROGRESS, [], ["#044"]]);
    expect(outline(mobilePanel(container))).toEqual(IN_PROGRESS);

    await click(/^Nouv\./);
    expect(outline(mobilePanel(container))).toEqual(["#041"]);

    await click(/^Prêtes/);
    expect(outline(mobilePanel(container))).toEqual(["#044"]);
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

  it("liste l'historique (onglet mobile, tiroir), compté comme les cartes, statut nommé", async () => {
    const { container } = await renderBoard();
    // The scheduled card counts its 1.5 kg line (3 × 500 g) as 3 articles.
    expect(container.textContent).toContain("3 articles44,85 €");

    await click(/^Histo\./);
    expect(outline(mobilePanel(container))).toEqual(["#040", "#039"]);

    await click(/^Historique/);
    const drawer = overlay("Historique");
    expect(outline(drawer)).toEqual(["#040", "#039"]);
    expect(drawer.textContent).toContain("#039Sarah.LRécupérée44,85 €3 articles");
    expect(drawer.textContent).toContain("#040Ines.TPartiel. refusée9,90 €1 article");
  });
});

describe("mode cuisine : état de la boutique", () => {
  it("suspend pour la durée choisie, relit l'état et ferme la fenêtre", async () => {
    await renderBoard();
    await click(/^Pause$/);
    await click(/^30/);
    const modal = within(overlay("Suspendre les commandes"));
    const choices = modal.getAllByRole("button").map((button) => button.textContent);
    expect(choices.slice(0, 3)).toEqual(["15minutes", "30minutes", "60minutes"]);
    expect(choices.slice(3)).toEqual(["Suspendre pendant 30 min", "Annuler"]);
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
    const banner = screen.getByText(/^Commandes suspendues/).parentElement!;
    const controls = container.querySelector("header")!.children[1];
    expect(banner.textContent).toBe("Commandes suspendues — reprise dans 10:00Reprendre");
    // The toggle reads « Hors ligne »; the pause button counts down (wide and narrow label).
    expect(controls.textContent).toBe("Hors ligneAuto 8h-19h 10:0010:00");

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
