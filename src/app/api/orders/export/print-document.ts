// src/app/api/orders/export/print-document.ts — the printable page of the order export, opened by
// the butcher in a tab of klikandgo.app. Every value is a substitution of the `html` tag, so what a
// customer or a shop typed (a guest's name, a product name) is printed as text. The only script is
// the print button's, allowed by the response's nonce (Content-Security-Policy of route.ts).
// Pure: no Date, no Prisma; the route passes every label already formatted.
import { html, trustedHtml, type SafeHtml } from "@/lib/html/escape";

export type PrintRow = {
  numero: string;
  dateStr: string;
  timeStr: string;
  clientName: string;
  phone: string;
  status: string;
  articles: string;
  total: string;
  payment: string;
};

const PRINT_STYLES = trustedHtml(`<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 32px; font-size: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #DC2626; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-circle { width: 36px; height: 36px; border-radius: 10px; background: #DC2626; color: white; font-weight: 900; font-size: 20px; display: flex; align-items: center; justify-content: center; }
  .logo-text { font-size: 20px; font-weight: 700; color: #DC2626; }
  .meta { text-align: right; font-size: 11px; color: #666; }
  .meta strong { color: #1a1a1a; display: block; font-size: 14px; margin-bottom: 2px; }
  .summary { display: flex; gap: 24px; margin-bottom: 20px; }
  .summary-card { background: #f8f6f3; padding: 12px 16px; border-radius: 8px; flex: 1; }
  .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f8f6f3; padding: 8px 10px; text-align: left; font-weight: 600; color: #444; border-bottom: 1px solid #ddd; white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  .text-right { text-align: right; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #999; text-align: center; }
  .print-bar { margin-bottom: 16px; text-align: center; }
  .print-button { padding: 10px 28px; background: #DC2626; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
    table { font-size: 10px; }
    th, td { padding: 5px 6px; }
  }
</style>`);

function orderRow(row: PrintRow): SafeHtml {
  return html`<tr>
    <td>${row.numero}</td>
    <td>${row.dateStr}</td>
    <td>${row.timeStr}</td>
    <td>${row.clientName}</td>
    <td>${row.phone}</td>
    <td>${row.status}</td>
    <td>${row.articles}</td>
    <td class="text-right">${row.total} &euro;</td>
    <td>${row.payment}</td>
  </tr>`;
}

/** The whole page: header, summary cards, one table row per order, print button. */
export function buildOrdersPrintDocument(input: {
  shopName: string;
  periodLabel: string;
  exportedAtLabel: string;
  rows: PrintRow[];
  orderCount: number;
  totalEur: string;
  averageEur: string;
  year: number;
  scriptNonce: string;
}): SafeHtml {
  return html`<!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Export commandes - ${input.shopName || "Klik&Go"}</title>
        ${PRINT_STYLES}
      </head>
      <body>
        <div class="no-print print-bar">
          <button id="print" type="button" class="print-button">Imprimer / Sauvegarder PDF</button>
        </div>
        <div class="header">
          <div class="logo">
            <div class="logo-circle">K</div>
            <div class="logo-text">Klik&amp;Go</div>
          </div>
          <div class="meta">
            <strong>${input.shopName || "Export commandes"}</strong>
            ${input.periodLabel}<br />
            Export du ${input.exportedAtLabel}
          </div>
        </div>
        <div class="summary">
          <div class="summary-card">
            <div class="label">Commandes</div>
            <div class="value">${input.orderCount}</div>
          </div>
          <div class="summary-card">
            <div class="label">CA Total</div>
            <div class="value">${input.totalEur} &euro;</div>
          </div>
          <div class="summary-card">
            <div class="label">Panier moyen</div>
            <div class="value">${input.averageEur} &euro;</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Heure</th>
              <th>Client</th>
              <th>Tel.</th>
              <th>Statut</th>
              <th>Articles</th>
              <th class="text-right">Total</th>
              <th>Paiement</th>
            </tr>
          </thead>
          <tbody>
            ${input.rows.map(orderRow)}
          </tbody>
        </table>
        <div class="footer">&copy; ${input.year} Klik&amp;Go &mdash; Export automatique</div>
        <script nonce="${input.scriptNonce}">
          document.getElementById("print").addEventListener("click", function () {
            window.print();
          });
        </script>
      </body>
    </html>`;
}
