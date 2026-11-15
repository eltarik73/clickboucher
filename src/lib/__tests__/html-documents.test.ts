// @vitest-environment node
// The HTML documents written by hand print what a person typed as text, never as markup (SEC-01,
// audit of 2026-11-15): the printable order export, the confirmation and receipt e-mails, the
// notification e-mails, the kitchen ticket. A guest named <img src=x onerror=alert(1)> stays a
// name, a shop renamed <b>x</b> by its butcher stays a name; « Zoé O'Brien » stays readable
// (accents kept, apostrophe as &#39;).
import { afterEach, describe, expect, it, vi } from "vitest";

const sentEmails = vi.hoisted(() => [] as Array<{ to: string; subject: string; html: string }>);
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (to: string, subject: string, html: string) => {
    sentEmails.push({ to, subject, html });
    return true;
  }),
}));

import { buildOrdersPrintDocument, type PrintRow } from "@/app/api/orders/export/print-document";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { buildTicketHtml } from "@/components/boucher/OrderTicket";
import {
  buildOrderConfirmationEmail,
  sendOrderConfirmationEmail,
} from "@/lib/emails/order-confirmation";
import { buildOrderReceiptEmail, type ReceiptData } from "@/lib/emails/order-receipt";
import * as notificationEmails from "@/lib/email-templates";

const PAYLOAD = "<img src=x onerror=alert(1)>";
const PAYLOAD_AS_TEXT = "&lt;img src=x onerror=alert(1)&gt;";
const READABLE = "Zoé O'Brien";
const READABLE_AS_TEXT = "Zoé O&#39;Brien";

const NONCE = "bm9uY2UtZGUtdGVzdA==";

function printDocument(name: string): string {
  const row: PrintRow = {
    numero: "#012",
    dateStr: "13/11/2026",
    timeStr: "12:00",
    clientName: `${name} Martin`,
    phone: "+33611223344",
    status: "En attente",
    articles: `1x ${name}`,
    total: "12,00",
    payment: "Sur place",
  };
  return buildOrdersPrintDocument({
    shopName: name,
    periodLabel: "Toutes les commandes",
    exportedAtLabel: "13/11/2026 à 12:00",
    rows: [row],
    orderCount: 1,
    totalEur: "12,00",
    averageEur: "12,00",
    year: 2026,
    scriptNonce: NONCE,
  }).value;
}

const confirmationData = (name: string) => ({
  trackingPath: "/suivi/order-1",
  displayNumber: "#012",
  customerFirstName: name,
  items: [{ name, quantity: 2, unit: "PIECE" as const, totalCents: 1200, weightGrams: null }],
  totalCents: 1200,
  shopName: name,
  shopAddress: name,
  shopCity: name,
  prepTimeMin: 20,
});

function receiptData(name: string): ReceiptData {
  return {
    orderId: "order-1",
    displayNumber: "#012",
    customerFirstName: name,
    customerLastName: name,
    customerNumber: null,
    items: [
      { name, quantity: 1, unit: "PIECE", totalCents: 1200, available: true, vatRate: 5.5 },
      { name, quantity: 1, unit: "PIECE", totalCents: 800, available: false, vatRate: 5.5 },
    ],
    totalCents: 1200,
    discountCents: 0,
    serviceFeeCents: 0,
    shopName: name,
    shopAddress: name,
    shopCity: name,
    shopSiret: name,
    shopFullAddress: null,
    paymentMethod: "ON_PICKUP",
    createdAt: new Date("2026-11-13T11:00:00Z"),
    pickedUpAt: new Date("2026-11-13T12:00:00Z"),
  };
}

function kitchenOrder(name: string): KitchenOrder {
  return {
    id: "order-1",
    orderNumber: "KG26-000194",
    displayNumber: "#012",
    status: "ACCEPTED",
    totalCents: 1200,
    discountCents: 0,
    customerNumber: null,
    isPro: false,
    customerNote: name,
    requestedTime: null,
    estimatedReady: null,
    actualReady: null,
    qrCode: null,
    paymentMethod: "ON_PICKUP",
    pickupSlotStart: null,
    createdAt: "2026-11-13T11:00:00.000Z",
    updatedAt: "2026-11-13T11:00:00.000Z",
    items: [
      {
        id: "a",
        productId: "product-a",
        name,
        quantity: 1,
        unit: "PIECE",
        priceCents: 1200,
        totalCents: 1200,
        weightGrams: null,
        sliceCount: null,
        sliceThickness: null,
        variant: null,
        pieceCount: null,
        pieceLabel: null,
        cutOption: null,
        available: true,
      },
    ],
    user: { firstName: name, lastName: "Martin" },
    priceAdjustment: null,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("printable order export", () => {
  it("prints a client name, a product name and a shop name made of markup as text", () => {
    const page = printDocument(PAYLOAD);

    expect(page).toContain(`<td>${PAYLOAD_AS_TEXT} Martin</td>`);
    expect(page).toContain(`<td>1x ${PAYLOAD_AS_TEXT}</td>`);
    expect(page).toContain(`<title>Export commandes - ${PAYLOAD_AS_TEXT}</title>`);
    expect(page).toContain(`<strong>${PAYLOAD_AS_TEXT}</strong>`);
    expect(page).not.toContain("<img");
  });

  it("wires the print button by its one nonce'd script, never by an inline handler", () => {
    const page = printDocument("Boucherie Test");

    expect(page).toContain('<button id="print" type="button"');
    expect(page).not.toContain("onclick");
    expect(page.match(/<script\b[^>]*>/g)).toEqual([`<script nonce="${NONCE}">`]);
    expect(page).toMatch(/getElementById\("print"\)\.addEventListener\("click"/);
  });

  it("keeps an accented name with an apostrophe readable", () => {
    expect(printDocument(READABLE)).toContain(`<td>${READABLE_AS_TEXT} Martin</td>`);
  });
});

describe("confirmation e-mail", () => {
  it("prints a name, an item, a shop and an address made of markup as text", () => {
    const { html } = buildOrderConfirmationEmail(
      confirmationData(PAYLOAD),
      "https://klikandgo.app"
    );

    expect(html).toContain(`Bonjour ${PAYLOAD_AS_TEXT},`);
    expect(html).toContain(`2\u00A0pièces ${PAYLOAD_AS_TEXT}`);
    expect(html).toContain(`Retrait chez ${PAYLOAD_AS_TEXT}`);
    expect(html).toContain(`${PAYLOAD_AS_TEXT}, ${PAYLOAD_AS_TEXT}`);
    expect(html).not.toContain("<img");
  });

  it("keeps an accented name with an apostrophe readable, the subject in plain text", () => {
    const { html, subject } = buildOrderConfirmationEmail(
      confirmationData(READABLE),
      "https://klikandgo.app"
    );

    expect(html).toContain(`Bonjour ${READABLE_AS_TEXT},`);
    expect(subject).toBe(`✅ Commande #012 confirmée — ${READABLE}`);
  });

  it("sends the escaped document to the customer, with the tracking link on the site's URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recette.klikandgo.test");
    sentEmails.length = 0;

    await sendOrderConfirmationEmail("zoe@example.test", confirmationData(PAYLOAD));

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("zoe@example.test");
    expect(sentEmails[0].subject).toBe(`✅ Commande #012 confirmée — ${PAYLOAD}`);
    expect(sentEmails[0].html).toContain(`Bonjour ${PAYLOAD_AS_TEXT},`);
    expect(sentEmails[0].html).toContain('href="https://recette.klikandgo.test/suivi/order-1"');
    expect(sentEmails[0].html).not.toContain("<img");
  });
});

describe("receipt e-mail", () => {
  it("prints a name, an item, a shop and its SIRET made of markup as text", () => {
    const { html } = buildOrderReceiptEmail(receiptData(PAYLOAD));

    expect(html).toContain(`Bonjour ${PAYLOAD_AS_TEXT},`);
    expect(html).toContain(`1\u00A0pièce ${PAYLOAD_AS_TEXT} — non fourni`);
    expect(html).toContain(`SIRET : ${PAYLOAD_AS_TEXT}`);
    expect(html).not.toContain("<img");
  });

  it("keeps an accented name with an apostrophe readable", () => {
    const { html, subject } = buildOrderReceiptEmail(receiptData(READABLE));

    expect(html).toContain(`Bonjour ${READABLE_AS_TEXT},`);
    expect(subject).toBe(`🧾 Reçu — Commande #012 — ${READABLE}`);
  });
});

describe("notification e-mails", () => {
  const MARKUP = "<b>x</b>";
  const MARKUP_AS_TEXT = "&lt;b&gt;x&lt;/b&gt;";
  // Every text field of NotifData set to markup (a shop renamed by its butcher, a product, a note).
  const typed = {
    orderId: MARKUP,
    orderNumber: MARKUP,
    shopName: MARKUP,
    qrCode: MARKUP,
    denyReason: MARKUP,
    customerName: MARKUP,
    note: MARKUP,
    message: MARKUP,
    weeklyTopProduct: MARKUP,
    name: MARKUP,
    city: MARKUP,
    estimatedMinutes: 20,
    nbItems: 2,
    originalTotal: 1500,
    newTotal: 1200,
  };

  it("prints a shop named <b>x</b> as text in the order-accepted e-mail", () => {
    const email = notificationEmails.orderAccepted(typed);

    expect(email).toContain(`chez <strong>${MARKUP_AS_TEXT}</strong>`);
    expect(email).not.toContain(MARKUP);
  });

  it.each(Object.keys(notificationEmails))("%s prints every typed value as text", (name) => {
    const template = notificationEmails[name as keyof typeof notificationEmails] as (
      data: typeof typed
    ) => string;

    expect(template(typed)).not.toContain(MARKUP);
  });
});

describe("kitchen ticket", () => {
  it("prints a guest name, an item and a note made of markup as text", () => {
    const ticket = buildTicketHtml(kitchenOrder(PAYLOAD), PAYLOAD);

    expect(ticket).toContain(`${PAYLOAD_AS_TEXT}.M`);
    expect(ticket).toContain(`<div class="note-box">${PAYLOAD_AS_TEXT}</div>`);
    expect(ticket).not.toContain("<img");
  });

  it("keeps an accented note with an apostrophe readable", () => {
    const ticket = buildTicketHtml(kitchenOrder(READABLE), "Boucherie Test");

    expect(ticket).toContain(`<div class="note-box">${READABLE_AS_TEXT}</div>`);
  });
});
