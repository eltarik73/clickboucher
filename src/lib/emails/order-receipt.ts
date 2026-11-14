// src/lib/emails/order-receipt.ts — the receipt e-mailed when an order is collected. The amounts come
// from summarizeReceipt (src/lib/pricing/receipt.ts): available lines only, the discount, any later
// adjustment, and Order.totalCents as the total, split by VAT rate.
import { sendEmail } from "@/lib/email";
import type { SaleUnit } from "@/lib/pricing/line";
import { formatStoredLineQuantity } from "@/lib/pricing/format";
import { summarizeReceipt, vatBreakdown } from "@/lib/pricing/receipt";

export interface ReceiptItem {
  name: string;
  /** Stored OrderItem.quantity: kilograms for KG and TRANCHE, a count otherwise. */
  quantity: number;
  unit: SaleUnit;
  totalCents: number;
  weightGrams?: number | null;
  /** false: out of stock or removed, not sold. */
  available: boolean;
  vatRate: number; // resolved rate (product or shop default)
}

export interface ReceiptData {
  orderId: string;
  displayNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerNumber: string | null;
  items: ReceiptItem[];
  /** Order.totalCents. */
  totalCents: number;
  /** Order.discountCents. */
  discountCents: number;
  /** Order.serviceFeeCents (charged only on an order paid online). */
  serviceFeeCents: number;
  shopName: string;
  shopAddress: string;
  shopCity: string;
  shopSiret: string | null;
  shopFullAddress: string | null;
  paymentMethod: string;
  createdAt: Date;
  pickedUpAt: Date | null;
}

function fmtPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

/** Quantity printed before the product name: "2 × 500 g", "470 g", "3 pièces". */
export function fmtQty(item: ReceiptItem): string {
  return formatStoredLineQuantity({
    unit: item.unit,
    quantity: item.quantity,
    weightGrams: item.weightGrams ?? null,
  });
}

function fmtDate(d: Date): string {
  return (
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " à " +
    d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    })
  );
}

function amountRow(label: string, cents: number, style = "font-size:13px;color:#666;"): string {
  return `<tr>
          <td style="padding:3px 0;${style}">${label}</td>
          <td style="padding:3px 0;${style}text-align:right;">${fmtPrice(cents)}</td>
        </tr>`;
}

/** Subject and HTML of the receipt. Pure: the printed total is Order.totalCents (+ the online fee). */
export function buildOrderReceiptEmail(data: ReceiptData): { subject: string; html: string } {
  const receipt = summarizeReceipt({
    lines: data.items,
    totalCents: data.totalCents,
    discountCents: data.discountCents,
    serviceFeeCents: data.serviceFeeCents,
    paymentMethod: data.paymentMethod,
  });
  const shopAddr = data.shopFullAddress || `${data.shopAddress}, ${data.shopCity}`;
  const customerName = `${data.customerFirstName} ${data.customerLastName.charAt(0)}.`;

  const itemsHtml = receipt.lines
    .map(
      (item) =>
        `<tr>
          <td style="padding:5px 0;color:#333;font-size:13px;">${fmtQty(item)} ${item.name}</td>
          <td style="padding:5px 0;color:#333;font-size:13px;text-align:right;">${fmtPrice(item.totalCents)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 0 4px;font-size:11px;color:#999;">(TVA ${item.vatRate}%)</td>
        </tr>`
    )
    .join("");

  const unavailableHtml = receipt.unavailableLines
    .map(
      (item) =>
        `<tr>
          <td colspan="2" style="padding:3px 0;color:#999;font-size:12px;text-decoration:line-through;">${fmtQty(item)} ${item.name} — non fourni</td>
        </tr>`
    )
    .join("");

  const amountsHtml = [
    amountRow("Sous-total articles", receipt.subtotalCents),
    receipt.discountCents > 0 ? amountRow("Remise", -receipt.discountCents) : "",
    receipt.adjustmentCents !== 0 ? amountRow("Ajustement du prix", receipt.adjustmentCents) : "",
    receipt.serviceFeeCents > 0 ? amountRow("Frais de service", receipt.serviceFeeCents) : "",
  ].join("");

  const vatGroupsHtml = vatBreakdown(receipt.lines, receipt.goodsTotalCents)
    .map(
      (g) =>
        `${amountRow(`Sous-total HT (TVA ${g.rate}%)`, g.htCents)}
        ${amountRow(`TVA ${g.rate}%`, g.vatCents)}`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:#DC2626;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Klik&Go</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Reçu de commande</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 16px 16px;">
      <p style="margin:0 0 8px;font-size:16px;color:#333;">Bonjour ${data.customerFirstName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#666;">Merci pour votre achat ! Voici votre reçu.</p>

      <!-- Shop header -->
      <div style="background:#f8f6f3;border-radius:12px;padding:16px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;font-size:15px;font-weight:800;color:#333;text-transform:uppercase;">${data.shopName}</p>
        <p style="margin:4px 0;font-size:12px;color:#666;">${shopAddr}</p>
        ${data.shopSiret ? `<p style="margin:4px 0 0;font-size:11px;color:#999;">SIRET : ${data.shopSiret}</p>` : ""}
      </div>

      <!-- Order meta -->
      <div style="border-bottom:1px solid #f0f0f0;padding-bottom:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#666;">
          <tr>
            <td style="padding:3px 0;">Commande</td>
            <td style="padding:3px 0;text-align:right;font-weight:700;color:#DC2626;">${data.displayNumber}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;">Client</td>
            <td style="padding:3px 0;text-align:right;">${customerName}${data.customerNumber ? ` (${data.customerNumber})` : ""}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;">Date</td>
            <td style="padding:3px 0;text-align:right;">${fmtDate(data.createdAt)}</td>
          </tr>
          ${
            data.pickedUpAt
              ? `<tr>
            <td style="padding:3px 0;">Retirée le</td>
            <td style="padding:3px 0;text-align:right;">${fmtDate(data.pickedUpAt)}</td>
          </tr>`
              : ""
          }
        </table>
      </div>

      <!-- Items -->
      <div style="margin-bottom:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;">Détail</p>
        <table style="width:100%;border-collapse:collapse;">
          ${itemsHtml}
          ${unavailableHtml}
        </table>
      </div>

      <!-- VAT breakdown -->
      <div style="border-top:2px solid #f0f0f0;padding-top:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          ${amountsHtml}
          ${vatGroupsHtml}
          <tr>
            <td colspan="2" style="padding:8px 0 0;border-top:2px solid #333;"></td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:16px;font-weight:800;color:#333;">TOTAL TTC</td>
            <td style="padding:4px 0;font-size:16px;font-weight:800;color:#333;text-align:right;">${fmtPrice(receipt.amountChargedCents)}</td>
          </tr>
        </table>
        <p style="margin:8px 0 0;font-size:12px;color:#999;">Paiement : ${data.paymentMethod === "ONLINE" ? "En ligne" : "Sur place"}</p>
      </div>

      <p style="margin:20px 0 0;font-size:13px;color:#666;text-align:center;">
        Merci de votre confiance !
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;">
      <p style="margin:0;font-size:12px;color:#999;">Klik&Go — www.klikgo.app</p>
    </div>
  </div>
</body>
</html>`;

  const subject = `🧾 Reçu — Commande ${data.displayNumber} — ${data.shopName}`;
  return { subject, html };
}

export async function sendOrderReceiptEmail(to: string, data: ReceiptData): Promise<boolean> {
  const { subject, html } = buildOrderReceiptEmail(data);
  return sendEmail(to, subject, html);
}
