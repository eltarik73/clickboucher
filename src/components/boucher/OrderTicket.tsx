// OrderTicket — Professional thermal receipt (302px / 80mm)
// Opens in a new window with auto-print and @media print isolation
"use client";

import type { KitchenOrder } from "@/hooks/use-order-polling";

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function formatUnit(unit: string) {
  return unit === "KG" ? "kg" : unit === "PIECE" ? "pc" : "barq.";
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

/** Open a printable thermal ticket in a new window */
export function printOrderTicket(order: KitchenOrder, shopName?: string) {
  const clientName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : "Client";

  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  // Build items HTML with dot leaders
  const itemsHtml = order.items
    .map((item) => {
      const qty = `${item.quantity} ${formatUnit(item.product?.unit || item.unit)}`;
      const name = item.product?.name || item.name;
      const price = formatPrice(item.totalCents || item.priceCents * item.quantity);
      const left = `${qty} ${name}`;
      return `<div class="item-line">${escapeHtml(dotLeaderLine(left, price))}</div>`;
    })
    .join("");

  // Payment method
  const paymentLabel =
    order.paymentMethod === "ONLINE"
      ? "Paye en ligne"
      : order.paymentMethod === "CARD"
      ? "Carte bancaire"
      : "Paiement sur place";

  // QR code section (simple text-based, the actual QR is client-side)
  const qrSection = order.qrCode
    ? `<div class="qr-section">
        <div class="qr-label">QR Code de retrait</div>
        <div class="qr-code">${escapeHtml(order.qrCode)}</div>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Ticket ${escapeHtml(ticketNumber)}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 12px;
      line-height: 1.4;
      width: 302px;
      margin: 0 auto;
      padding: 12px 8px;
      color: #000;
      background: #fff;
    }

    /* ── Header ── */
    .header {
      text-align: center;
      padding-bottom: 8px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 2px;
    }
    .shop-name {
      font-size: 14px;
      font-weight: bold;
      margin-top: 2px;
    }
    .subtitle {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }

    /* ── Dividers ── */
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .divider-double {
      border: none;
      border-top: 2px solid #000;
      margin: 6px 0;
    }

    /* ── Order info ── */
    .order-info {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: bold;
    }
    .order-meta {
      font-size: 11px;
      color: #333;
      margin-top: 2px;
    }

    /* ── Items ── */
    .item-line {
      font-size: 12px;
      white-space: pre;
      font-family: 'Courier New', monospace;
      line-height: 1.6;
    }

    /* ── Total ── */
    .total-section {
      text-align: right;
      padding: 4px 0;
    }
    .total-items {
      font-size: 11px;
      color: #666;
    }
    .total-price {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 1px;
    }

    /* ── Payment ── */
    .payment {
      font-size: 11px;
      text-align: center;
      padding: 4px;
      background: #f0f0f0;
      border-radius: 3px;
      margin: 4px 0;
    }

    /* ── Client ── */
    .client-section {
      font-size: 11px;
    }
    .client-section .label {
      color: #666;
    }
    .client-section .value {
      font-weight: bold;
    }
    .pro-badge {
      display: inline-block;
      background: #DC2626;
      color: white;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      margin-left: 4px;
    }

    /* ── Note ── */
    .note-section {
      background: #f5f5f5;
      padding: 6px;
      border-radius: 3px;
      font-size: 11px;
      margin: 4px 0;
    }
    .note-section .note-label {
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      color: #666;
    }

    /* ── QR ── */
    .qr-section {
      text-align: center;
      padding: 8px 0 4px;
    }
    .qr-label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .qr-code {
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 2px;
      padding: 4px;
      border: 1px dashed #999;
      display: inline-block;
      margin-top: 4px;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding-top: 8px;
    }
    .footer .thanks {
      font-size: 13px;
      font-weight: bold;
    }
    .footer .tagline {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
    .footer .date {
      font-size: 9px;
      color: #999;
      margin-top: 4px;
    }

    /* ── Print ── */
    @media print {
      body { width: 100%; padding: 0 4px; }
      .no-print { display: none !important; }
    }

    /* ── Screen print button ── */
    .print-btn {
      display: block;
      width: 100%;
      padding: 10px;
      margin-top: 12px;
      background: #DC2626;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      font-family: sans-serif;
    }
    .print-btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="logo-text">KLIK&amp;GO</div>
    <div class="shop-name">${escapeHtml(shopName || "Klik&Go")}</div>
    <div class="subtitle">Ticket de commande</div>
  </div>

  <hr class="divider-double">

  <!-- Order info -->
  <div class="order-info">
    <span>${escapeHtml(ticketNumber)}</span>
    <span>${formatTime(order.createdAt)}</span>
  </div>
  <div class="order-meta">
    ${formatDate(order.createdAt)}
  </div>

  <hr class="divider">

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

  <!-- Client -->
  <div class="client-section">
    <span class="label">Client :</span>
    <span class="value">${escapeHtml(clientName)}</span>
    ${order.isPro ? '<span class="pro-badge">PRO</span>' : ""}
  </div>

  ${order.customerNote ? `
  <div class="note-section">
    <div class="note-label">Note client</div>
    <div>${escapeHtml(order.customerNote)}</div>
  </div>` : ""}

  ${order.requestedTime ? `
  <div class="client-section" style="margin-top:4px">
    <span class="label">Retrait :</span>
    <span class="value">${formatTime(order.requestedTime)}</span>
  </div>` : ""}

  ${qrSection}

  <hr class="divider">

  <!-- Footer -->
  <div class="footer">
    <div class="thanks">Merci pour votre commande !</div>
    <div class="tagline">Zero file, zero stress, 100% frais</div>
    <div class="date">Klik&amp;Go &mdash; ${formatDate(new Date().toISOString())}</div>
  </div>

  <!-- Print button (screen only) -->
  <button class="print-btn no-print" onclick="window.print()">
    Imprimer le ticket
  </button>

  <script>
    // Auto-print on load
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
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
