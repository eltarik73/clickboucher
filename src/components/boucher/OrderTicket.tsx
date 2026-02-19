// OrderTicket — Open a print-ready ticket in a new window
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

/** Open a printable ticket in a new window */
export function printOrderTicket(order: KitchenOrder, shopName?: string) {
  const clientName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : "Client";

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:4px 0;border-bottom:1px dashed #ccc">
          ${item.quantity} ${formatUnit(item.product?.unit || item.unit)} — ${item.product?.name || item.name}
        </td>
        <td style="padding:4px 0;border-bottom:1px dashed #ccc;text-align:right;white-space:nowrap">
          ${formatPrice(item.totalCents || item.priceCents * item.quantity)}
        </td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket #${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      max-width: 80mm;
      margin: 0 auto;
      padding: 8px;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .header { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-weight: bold; font-size: 15px; padding-top: 8px; }
    .note { background: #f5f5f5; padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 12px; }
    @media print {
      body { max-width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="header">${shopName || "Klik&Go"}</div>
    <div style="font-size:11px;color:#666">Ticket de commande</div>
  </div>

  <hr class="divider">

  <div style="display:flex;justify-content:space-between">
    <span class="bold">#${order.orderNumber}</span>
    <span>${formatTime(order.createdAt)}</span>
  </div>
  <div style="margin-top:2px">
    <span>Client : ${clientName}</span>
    ${order.isPro ? ' <span style="background:#DC2626;color:white;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:bold">PRO</span>' : ""}
  </div>

  <hr class="divider">

  <table>
    ${itemsHtml}
    <tr class="total-row">
      <td style="padding-top:8px">TOTAL</td>
      <td style="padding-top:8px;text-align:right">${formatPrice(order.totalCents)}</td>
    </tr>
  </table>

  ${order.customerNote ? `<hr class="divider"><div class="note"><strong>Note client :</strong> ${order.customerNote}</div>` : ""}
  ${order.requestedTime ? `<div style="margin-top:4px;font-size:12px">Retrait souhaite : ${formatTime(order.requestedTime)}</div>` : ""}

  <hr class="divider">
  <div class="center" style="font-size:10px;color:#999;margin-top:4px">
    Klik&Go - ${new Date().toLocaleDateString("fr-FR")}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=350,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
