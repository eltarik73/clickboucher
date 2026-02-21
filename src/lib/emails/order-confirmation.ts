import { sendEmail } from "@/lib/email";

interface OrderItem {
  name: string;
  quantity: number;
  unit: string;
  totalCents: number;
  weightGrams?: number | null;
}

interface ConfirmationData {
  orderId: string;
  displayNumber: string;
  customerFirstName: string;
  items: OrderItem[];
  totalCents: number;
  shopName: string;
  shopAddress: string;
  shopCity: string;
  prepTimeMin: number;
}

function fmtPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtQty(item: OrderItem): string {
  if (item.unit === "KG" && item.weightGrams) {
    return `${(item.weightGrams / 1000).toFixed(1).replace(".", ",")} kg`;
  }
  return `${item.quantity}x`;
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: ConfirmationData
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clickboucher-production.up.railway.app";
  const suiviUrl = `${baseUrl}/suivi/${data.orderId}`;

  const itemsHtml = data.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 0;color:#333;font-size:14px;">${fmtQty(item)} ${item.name}</td>
          <td style="padding:6px 0;color:#333;font-size:14px;text-align:right;font-weight:600;">${fmtPrice(item.totalCents)}</td>
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
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 16px 16px;">
      <p style="margin:0 0 8px;font-size:16px;color:#333;">Bonjour ${data.customerFirstName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#666;">Votre commande a bien été enregistrée.</p>

      <!-- Ticket number -->
      <div style="text-align:center;padding:20px 0;margin-bottom:24px;">
        <div style="display:inline-block;background:#FEF2F2;border:2px solid #FECACA;border-radius:12px;padding:16px 32px;">
          <div style="font-size:36px;font-weight:900;color:#DC2626;letter-spacing:2px;">${data.displayNumber}</div>
          <div style="font-size:12px;color:#999;margin-top:4px;">Numéro de retrait</div>
        </div>
      </div>

      <!-- Items -->
      <div style="border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;padding:16px 0;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          ${itemsHtml}
        </table>
      </div>

      <!-- Total -->
      <div style="text-align:right;margin-bottom:24px;">
        <span style="font-size:18px;font-weight:800;color:#333;">Total : ${fmtPrice(data.totalCents)}</span>
      </div>

      <!-- Shop info -->
      <div style="background:#f8f6f3;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#333;">📍 Retrait chez ${data.shopName}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#666;">${data.shopAddress}, ${data.shopCity}</p>
        <p style="margin:0;font-size:13px;color:#666;">🕐 Temps estimé : ~${data.prepTimeMin} minutes</p>
      </div>

      <p style="margin:0 0 20px;font-size:14px;color:#666;">
        Présentez votre numéro <strong style="color:#DC2626;">${data.displayNumber}</strong> au comptoir.
      </p>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${suiviUrl}" style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;">
          📋 Suivre ma commande
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;">
      <p style="margin:0;font-size:12px;color:#999;">Klik&Go — Click & Collect pour boucheries</p>
    </div>
  </div>
</body>
</html>`;

  const subject = `✅ Commande ${data.displayNumber} confirmée — ${data.shopName}`;
  return sendEmail(to, subject, html);
}
