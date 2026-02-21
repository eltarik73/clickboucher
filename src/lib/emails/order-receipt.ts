import { sendEmail } from "@/lib/email";

interface ReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  totalCents: number;
  weightGrams?: number | null;
  vatRate: number; // resolved rate (product or shop default)
}

interface ReceiptData {
  orderId: string;
  displayNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerNumber: string | null;
  items: ReceiptItem[];
  totalCents: number;
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

function fmtQty(item: ReceiptItem): string {
  if (item.unit === "KG" && item.weightGrams) {
    return `${(item.weightGrams / 1000).toFixed(1).replace(".", ",")} kg`;
  }
  return `${item.quantity}x`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) + " à " + d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/**
 * Calculate VAT breakdown from TTC prices.
 * prixTTC / (1 + taux) = prixHT, TVA = TTC - HT
 */
function calculateVatBreakdown(items: ReceiptItem[]): {
  groups: { rate: number; totalTTC: number; totalHT: number; totalVAT: number }[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
} {
  const byRate = new Map<number, number>();

  for (const item of items) {
    const current = byRate.get(item.vatRate) || 0;
    byRate.set(item.vatRate, current + item.totalCents);
  }

  const groups = Array.from(byRate.entries()).map(([rate, totalTTC]) => {
    const totalHT = Math.round(totalTTC / (1 + rate / 100));
    return {
      rate,
      totalTTC,
      totalHT,
      totalVAT: totalTTC - totalHT,
    };
  });

  return {
    groups,
    totalHT: groups.reduce((s, g) => s + g.totalHT, 0),
    totalVAT: groups.reduce((s, g) => s + g.totalVAT, 0),
    totalTTC: groups.reduce((s, g) => s + g.totalTTC, 0),
  };
}

export async function sendOrderReceiptEmail(
  to: string,
  data: ReceiptData
): Promise<boolean> {
  const vat = calculateVatBreakdown(data.items);
  const shopAddr = data.shopFullAddress || `${data.shopAddress}, ${data.shopCity}`;
  const customerName = `${data.customerFirstName} ${data.customerLastName.charAt(0)}.`;

  const itemsHtml = data.items
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

  const vatGroupsHtml = vat.groups
    .map(
      (g) =>
        `<tr>
          <td style="padding:3px 0;font-size:13px;color:#666;">Sous-total HT (TVA ${g.rate}%)</td>
          <td style="padding:3px 0;font-size:13px;color:#666;text-align:right;">${fmtPrice(g.totalHT)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;font-size:13px;color:#666;">TVA ${g.rate}%</td>
          <td style="padding:3px 0;font-size:13px;color:#666;text-align:right;">${fmtPrice(g.totalVAT)}</td>
        </tr>`
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
          ${data.pickedUpAt ? `<tr>
            <td style="padding:3px 0;">Retirée le</td>
            <td style="padding:3px 0;text-align:right;">${fmtDate(data.pickedUpAt)}</td>
          </tr>` : ""}
        </table>
      </div>

      <!-- Items -->
      <div style="margin-bottom:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;">Détail</p>
        <table style="width:100%;border-collapse:collapse;">
          ${itemsHtml}
        </table>
      </div>

      <!-- VAT breakdown -->
      <div style="border-top:2px solid #f0f0f0;padding-top:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          ${vatGroupsHtml}
          <tr>
            <td colspan="2" style="padding:8px 0 0;border-top:2px solid #333;"></td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:16px;font-weight:800;color:#333;">TOTAL TTC</td>
            <td style="padding:4px 0;font-size:16px;font-weight:800;color:#333;text-align:right;">${fmtPrice(vat.totalTTC)}</td>
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
  return sendEmail(to, subject, html);
}
