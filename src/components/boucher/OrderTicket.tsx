// OrderTicket — Uber Eats style thermal receipt (80mm / 302px)
// Silent printing via hidden iframe — no new tab/window/popup
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

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
    " a " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatClientName(firstName: string, lastName: string): string {
  if (!firstName) return "Client";
  const first = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
  return lastInitial ? `${first}.${lastInitial}` : first;
}

/** Extract a 4-digit numeric pickup code from a UUID */
function getPickupCode(qrCode: string): string {
  const hex = qrCode.replace(/-/g, "").slice(0, 8);
  const num = parseInt(hex, 16) % 10000;
  return String(num).padStart(4, "0");
}

/** Inline SVG logo (Klik&Go red circle with K) */
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

/** Build item quantity string */
function formatItemQty(item: KitchenOrder["items"][0]): string {
  const unit = item.product?.unit || item.unit;
  if (unit === "KG" && item.weightGrams) {
    if (item.weightGrams >= 1000) {
      const kg = item.weightGrams / 1000;
      return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)} kg`;
    }
    return `${item.weightGrams}g`;
  }
  return `${item.quantity} ${formatUnit(unit)}`;
}

/** Build the HTML for a single Uber Eats style ticket */
function buildTicketHtml(order: KitchenOrder, shopName: string): string {
  const clientName = order.user
    ? formatClientName(order.user.firstName, order.user.lastName)
    : "Client";

  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;

  // Pickup time
  const isScheduled = !!order.pickupSlotStart;
  const pickupTimeStr = isScheduled ? formatTime(order.pickupSlotStart!) : null;

  // Prep date
  const prepDateStr = isScheduled
    ? formatDateFull(order.pickupSlotStart!)
    : order.estimatedReady
      ? formatDateFull(order.estimatedReady)
      : null;

  // Items
  const itemsHtml = order.items
    .map((item) => {
      const qtyStr = formatItemQty(item);
      const name = item.product?.name || item.name;
      const variantStr = item.variant ? ` [${item.variant}]` : "";
      const pieceStr = item.pieceCount && item.pieceLabel ? ` (${item.pieceCount} ${item.pieceLabel})` : "";
      const price = formatPrice(item.totalCents || item.priceCents * item.quantity);
      return `<div class="item">
      <div class="item-line"><span>${escapeHtml(qtyStr)} ${escapeHtml(name)}${escapeHtml(variantStr)}${escapeHtml(pieceStr)}</span><span class="item-price">${escapeHtml(price)}</span></div>
      <div class="item-halal">HALAL</div>
    </div>`;
    })
    .join("");

  // Pickup code (4 digits)
  const pickupCode = order.qrCode ? getPickupCode(order.qrCode) : null;

  // Customer note
  const noteHtml = order.customerNote
    ? `<div class="note-section">
        <div class="note-title">Remarque du client :</div>
        <div class="note-box">${escapeHtml(order.customerNote)}</div>
      </div>`
    : "";

  return `
  <div class="ticket">
    <div class="double-line"></div>
    <div class="header">
      ${LOGO_SVG}
      <div class="brand">Klik&amp;Go</div>
      <div class="shop-name">${escapeHtml(shopName)}</div>
    </div>
    <div class="double-line"></div>

    <div class="hero">
      <span class="hero-number">${escapeHtml(ticketNumber)}</span>
      <span class="hero-name">${escapeHtml(clientName)}${order.isPro ? ' <span class="pro-badge">PRO</span>' : ""}</span>
    </div>

    <div class="dates">
      Commande pass\u00E9e le ${formatDateFull(order.createdAt)}<br>
      ${prepDateStr ? `\u00C0 pr\u00E9parer pour le ${prepDateStr}` : "\u00C0 pr\u00E9parer d\u00E8s que possible"}
    </div>

    <div class="pickup-box">
      ${isScheduled ? `RETRAIT ${pickupTimeStr}` : "RETRAIT D\u00C8S QUE POSSIBLE"}
    </div>

    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>

    ${noteHtml}

    <div class="divider"></div>
    <div class="totals">
      <div class="total-row"><span>Sous-total</span><span>${formatPrice(order.totalCents)}</span></div>
      <div class="total-row"><span>Montant pay\u00E9</span><span>${formatPrice(order.totalCents)}</span></div>
    </div>
    <div class="divider"></div>

    ${pickupCode ? `<div class="code-section">\uD83D\uDD11 Code retrait : ${pickupCode}</div>` : ""}

    <div class="divider"></div>
    <div class="footer">Merci &mdash; www.klikandgo.app</div>
    <div class="double-line"></div>
  </div>`;
}

/** CSS styles for the Uber Eats style thermal ticket — tablet + desktop compatible */
const TICKET_CSS = `
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 12px;
      line-height: 1.4;
      width: 302px;
      max-width: 302px;
      margin: 0 auto;
      padding: 0;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .ticket { padding: 8px; width: 302px; max-width: 302px; }
    .double-line { border-top: 3px double #000; margin: 4px 0; }
    .header { text-align: center; padding: 4px 0; }
    .brand { text-align: center; font-size: 20px; font-weight: 900; letter-spacing: 2px; padding: 4px 0; }
    .shop-name { font-size: 13px; font-weight: bold; color: #333; margin-top: 2px; text-align: center; }
    .hero {
      background: #000 !important;
      color: #fff !important;
      padding: 10px 12px;
      text-align: center;
      margin: 6px 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .hero-number { font-size: 28px; font-weight: 900; letter-spacing: 2px; display: inline; }
    .hero-name { font-size: 22px; font-weight: 700; margin-left: 12px; display: inline; }
    .pro-badge { display: inline-block; background: #DC2626 !important; color: white !important; padding: 1px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; vertical-align: middle; -webkit-print-color-adjust: exact !important; }
    .dates { text-align: center; font-size: 11px; line-height: 1.6; padding: 6px 0; color: #333; }
    .pickup-box { text-align: center; font-size: 22px; font-weight: 900; letter-spacing: 2px; border: 3px solid #000; padding: 8px; margin: 8px 12px; }
    .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .item { margin: 6px 0; }
    .item-line { font-size: 12px; font-weight: 500; overflow: hidden; }
    .item-line span:first-child { float: left; max-width: 220px; }
    .item-price { float: right; white-space: nowrap; }
    .item-line::after { content: ''; display: table; clear: both; }
    .item-halal { font-size: 10px; color: #666; padding-left: 8px; margin-top: 1px; clear: both; }
    .note-section { margin: 6px 0; }
    .note-title { font-size: 11px; text-align: center; color: #666; margin-bottom: 4px; }
    .note-box { border: 1px solid #000; padding: 6px 8px; font-size: 11px; border-radius: 2px; }
    .totals { padding: 4px 0; }
    .total-row { font-size: 13px; font-weight: bold; padding: 2px 0; overflow: hidden; }
    .total-row span:first-child { float: left; }
    .total-row span:last-child { float: right; }
    .total-row::after { content: ''; display: table; clear: both; }
    .code-section { text-align: center; font-size: 16px; font-weight: 900; padding: 8px 0; letter-spacing: 1px; }
    .footer { text-align: center; font-size: 12px; padding: 6px 0; color: #333; }
    @media print {
      html, body { width: 80mm !important; max-width: 80mm !important; padding: 0 !important; margin: 0 !important; }
      .ticket { width: 80mm !important; max-width: 80mm !important; }
    }
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
    iframe.style.height = "900px"; // real height so tablet renders content
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.zIndex = "-9999";
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
 *  Used when silent print fails or user clicks "Reimprimer". */
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
