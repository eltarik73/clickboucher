// OrderTicket — Professional thermal receipt (302px / 80mm)
// Silent printing via hidden iframe — no new tab/window
"use client";

import type { KitchenOrder } from "@/hooks/use-order-polling";

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function formatUnit(unit: string) {
  return unit === "KG" ? "kg" : unit === "PIECE" ? "pc" : unit === "TRANCHE" ? "tr." : "barq.";
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Build a dot leader line: "2 kg — Merguez .... 12,50 €" */
function dotLeaderLine(left: string, right: string, maxChars = 38): string {
  const available = maxChars - left.length - right.length;
  const dots = available > 2 ? " " + ".".repeat(available - 2) + " " : " ";
  return left + dots + right;
}

/** Inline SVG logo for the ticket (same as KlikLogo.tsx) */
const LOGO_SVG = `<svg viewBox="0 0 100 100" width="48" height="48" style="display:block;margin:0 auto;">
  <defs>
    <linearGradient id="tktGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a83320"/>
      <stop offset="50%" stop-color="#DC2626"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#tktGrad)"/>
  <path d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z" fill="white"/>
  <rect x="76" y="33" width="14" height="3.5" rx="1.75" fill="white" opacity="0.7"/>
  <rect x="79" y="43" width="16" height="3" rx="1.5" fill="white" opacity="0.5"/>
  <rect x="76" y="53" width="12" height="2.5" rx="1.25" fill="white" opacity="0.3"/>
</svg>`;

/** Build the HTML for a single ticket */
function buildTicketHtml(order: KitchenOrder, shopName: string): string {
  const clientName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : "Client";

  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const itemsHtml = order.items
    .map((item) => {
      const qty = `${item.quantity} ${formatUnit(item.product?.unit || item.unit)}`;
      const name = item.product?.name || item.name;
      const price = formatPrice(item.totalCents || item.priceCents * item.quantity);
      const left = `${qty} ${name}`;
      return `<div class="item-line">${escapeHtml(dotLeaderLine(left, price))}</div>`;
    })
    .join("");

  const paymentLabel =
    order.paymentMethod === "ONLINE"
      ? "Paye en ligne"
      : order.paymentMethod === "CARD"
      ? "Carte bancaire"
      : "Paiement sur place";

  const qrSection = order.qrCode
    ? `<div class="qr-section">
        <div class="qr-label">Code retrait</div>
        <div class="qr-code">${escapeHtml(order.qrCode)}</div>
      </div>`
    : "";

  return `
  <div class="ticket">
    <!-- Header with logo -->
    <div class="header">
      ${LOGO_SVG}
      <div class="brand-name">Klik&amp;Go</div>
      <div class="shop-name">${escapeHtml(shopName || "Klik&Go")}</div>
    </div>

    <hr class="divider">

    <!-- Big ticket number + client name -->
    <div class="hero">
      <div class="ticket-number">${escapeHtml(ticketNumber)}</div>
      <div class="client-name">${escapeHtml(clientName)}${order.isPro ? ' <span class="pro-badge">PRO</span>' : ""}</div>
      <div class="order-meta">
        ${formatTime(order.createdAt)} &middot; ${formatDate(order.createdAt)}
      </div>
    </div>

    ${order.pickupSlotStart ? `
    <div class="scheduled-banner">
      <div class="scheduled-icon">📅</div>
      <div class="scheduled-label">COMMANDE PROGRAMMEE</div>
      <div class="scheduled-time">RETRAIT A ${formatTime(order.pickupSlotStart)}</div>
    </div>
    ` : ""}

    <hr class="divider-double">

    <!-- Items -->
    ${itemsHtml}

    <hr class="divider-double">

    <!-- Total -->
    <div class="total-section">
      <div class="total-items">${itemCount} article${itemCount > 1 ? "s" : ""}</div>
      <div class="total-price">TOTAL ${formatPrice(order.totalCents)}</div>
    </div>

    <hr class="divider">

    <!-- Payment -->
    <div class="payment">${escapeHtml(paymentLabel)}</div>

    ${order.customerNote ? `
    <div class="note-section">
      <div class="note-label">Note client</div>
      <div>${escapeHtml(order.customerNote)}</div>
    </div>` : ""}

    ${order.pickupSlotStart ? `
    <div class="info-line">
      Retrait : <strong>${formatTime(order.pickupSlotStart)}</strong>
    </div>` : order.requestedTime ? `
    <div class="info-line">
      Retrait : <strong>${formatTime(order.requestedTime)}</strong>
    </div>` : ""}

    ${qrSection}

    <hr class="divider">

    <!-- Footer -->
    <div class="footer">
      <div class="thanks">Merci pour votre commande !</div>
      <div class="tagline">Zero file, zero stress, 100% frais</div>
      <div class="date">Klik&amp;Go &mdash; ${formatDate(new Date().toISOString())}</div>
    </div>
  </div>`;
}

/** CSS styles for the thermal ticket (shared between silent and fallback) */
const TICKET_CSS = `
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 12px;
      line-height: 1.4;
      width: 302px;
      margin: 0 auto;
      padding: 0;
      color: #000;
      background: #fff;
    }
    .ticket { padding: 12px 8px; position: relative; }
    .header { text-align: center; padding-bottom: 6px; }
    .brand-name { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-top: 4px; }
    .shop-name { font-size: 14px; font-weight: bold; margin-top: 2px; color: #333; }
    .hero { text-align: center; padding: 8px 0; }
    .ticket-number { font-size: 28px; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
    .client-name { font-size: 22px; font-weight: bold; margin-top: 2px; line-height: 1.2; }
    .order-meta { font-size: 11px; color: #666; margin-top: 4px; }
    .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .divider-double { border: none; border-top: 2px solid #000; margin: 6px 0; }
    .item-line { font-size: 12px; white-space: pre; font-family: 'Courier New', monospace; line-height: 1.6; }
    .total-section { text-align: right; padding: 4px 0; }
    .total-items { font-size: 11px; color: #666; }
    .total-price { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
    .payment { font-size: 11px; text-align: center; padding: 4px; background: #f0f0f0; border-radius: 3px; margin: 4px 0; }
    .pro-badge { display: inline-block; background: #DC2626; color: white; padding: 1px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; vertical-align: middle; }
    .note-section { background: #f5f5f5; padding: 6px; border-radius: 3px; font-size: 11px; margin: 4px 0; }
    .note-section .note-label { font-weight: bold; font-size: 10px; text-transform: uppercase; color: #666; }
    .scheduled-banner { text-align: center; padding: 8px 6px; margin: 6px 0; background: #000; color: #fff; border: 2px solid #000; border-radius: 4px; }
    .scheduled-icon { font-size: 20px; line-height: 1; }
    .scheduled-label { font-size: 14px; font-weight: 900; letter-spacing: 1px; margin-top: 2px; }
    .scheduled-time { font-size: 18px; font-weight: 900; letter-spacing: 2px; margin-top: 2px; }
    .info-line { font-size: 11px; margin: 4px 0; }
    .qr-section { text-align: center; padding: 8px 0 4px; }
    .qr-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .qr-code { font-size: 11px; font-weight: bold; letter-spacing: 2px; padding: 4px; border: 1px dashed #999; display: inline-block; margin-top: 4px; }
    .footer { text-align: center; padding-top: 8px; }
    .footer .thanks { font-size: 13px; font-weight: bold; }
    .footer .tagline { font-size: 10px; color: #666; margin-top: 2px; }
    .footer .date { font-size: 9px; color: #999; margin-top: 4px; }
    @media print { body { width: 100%; padding: 0; } }
`;

/** Build the full HTML document for the ticket */
function buildFullHtml(order: KitchenOrder, shopName: string): string {
  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Ticket ${escapeHtml(ticketNumber)}</title>
  <style>${TICKET_CSS}</style>
</head>
<body>
  ${buildTicketHtml(order, shopName)}
</body>
</html>`;
}

/** Print a single ticket silently via a hidden iframe.
 *  No new tab, no popup, no preview — goes straight to printer.
 *  Returns true if print was triggered, false on failure. */
export function printOrderTicket(order: KitchenOrder, shopName?: string): boolean {
  const shop = shopName || "Klik&Go";
  const html = buildFullHtml(order, shop);

  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "302px";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return false;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Clean up iframe after print (or after timeout fallback)
    const cleanup = () => {
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
    };

    iframe.contentWindow?.addEventListener("afterprint", cleanup);

    // Small delay for rendering, then trigger print
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        cleanup();
      }
      // Safety: remove iframe after 10s even if afterprint never fires
      setTimeout(cleanup, 10_000);
    }, 250);

    return true;
  } catch {
    return false;
  }
}

/** Fallback: open ticket in a new window (manual print).
 *  Used when silent print fails or user clicks "Réimprimer". */
export function printOrderTicketFallback(order: KitchenOrder, shopName?: string) {
  const shop = shopName || "Klik&Go";
  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  const ticketHtml = buildTicketHtml(order, shop);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Ticket ${escapeHtml(ticketNumber)}</title>
  <style>
    ${TICKET_CSS}
    .no-print { display: block; }
    @media print { .no-print { display: none !important; } }
    .print-btn {
      display: block; width: 280px; margin: 12px auto; padding: 10px;
      background: #DC2626; color: white; border: none; border-radius: 8px;
      font-size: 14px; font-weight: bold; cursor: pointer; font-family: sans-serif;
    }
    .print-btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  ${ticketHtml}
  <button class="print-btn no-print" onclick="window.print()">Imprimer le ticket</button>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=350,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

/** Escape HTML entities for safe injection */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
