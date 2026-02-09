// ─────────────────────────────────────────────
// Shared layout wrapper
// ─────────────────────────────────────────────
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr>
    <td style="background:#DC2626;padding:24px 32px;text-align:center">
      <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Klik&amp;Go</span>
    </td>
  </tr>
  <!-- Content -->
  <tr>
    <td style="padding:32px">${content}</td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">Klik&amp;Go &mdash; Click &amp; Collect Boucherie</p>
      <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">Cet email a \u00e9t\u00e9 envoy\u00e9 automatiquement, merci de ne pas y r\u00e9pondre.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td>
<a href="${href}" style="display:inline-block;padding:12px 28px;background:#DC2626;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">${label}</a>
</td></tr></table>`;
}

// ─────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────
export function orderAccepted(data: {
  orderNumber?: string;
  shopName?: string;
  estimatedMinutes?: number;
  qrCode?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\u2705 Commande accept\u00e9e !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Votre commande <strong>${data.orderNumber}</strong> chez <strong>${data.shopName}</strong> a \u00e9t\u00e9 accept\u00e9e.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">\u23f1 Temps de pr\u00e9paration estim\u00e9</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#111827">${data.estimatedMinutes || "?"} min</p>
      </td></tr>
    </table>
    ${data.qrCode ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">QR Code de retrait</p>
        <p style="margin:0;font-size:16px;font-weight:600;font-family:monospace;color:#111827;word-break:break-all">${data.qrCode}</p>
      </td></tr>
    </table>` : ""}
    <p style="margin:0 0 4px;font-size:13px;color:#9ca3af">Pr\u00e9sentez ce QR code au boucher lors du retrait.</p>
    ${button(`${baseUrl}/commandes`, "Voir ma commande")}
  `);
}

export function orderReady(data: {
  orderNumber?: string;
  shopName?: string;
  qrCode?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83c\udf89 Votre commande est pr\u00eate !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      La commande <strong>${data.orderNumber}</strong> est pr\u00eate \u00e0 retirer chez <strong>${data.shopName}</strong>.
    </p>
    ${data.qrCode ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#047857">QR Code de retrait</p>
        <p style="margin:0;font-size:16px;font-weight:600;font-family:monospace;color:#065f46;word-break:break-all">${data.qrCode}</p>
      </td></tr>
    </table>` : ""}
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Rendez-vous en boucherie avec votre QR code pour r\u00e9cup\u00e9rer votre commande.</p>
    ${button(`${baseUrl}/commandes`, "Voir ma commande")}
  `);
}

export function orderDenied(data: {
  orderNumber?: string;
  shopName?: string;
  denyReason?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\u274c Commande refus\u00e9e</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      D\u00e9sol\u00e9, votre commande <strong>${data.orderNumber}</strong> chez <strong>${data.shopName}</strong> n\u2019a pas pu \u00eatre accept\u00e9e.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#991b1b;font-weight:600">Raison</p>
        <p style="margin:0;font-size:14px;color:#7f1d1d">${data.denyReason || "Non pr\u00e9cis\u00e9e"}</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280">Vous pouvez passer une nouvelle commande aupr\u00e8s d\u2019une autre boucherie.</p>
    ${button(`${baseUrl}/decouvrir`, "D\u00e9couvrir les boucheries")}
  `);
}

export function orderPending(data: {
  orderNumber?: string;
  customerName?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83d\udd14 Nouvelle commande !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Vous avez re\u00e7u une nouvelle commande <strong>#${data.orderNumber}</strong> de <strong>${data.customerName || "un client"}</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Connectez-vous \u00e0 votre espace boucher pour accepter ou refuser cette commande.</p>
    ${button(`${baseUrl}/boucher/commandes`, "G\u00e9rer les commandes")}
  `);
}

export function orderPickedUp(data: {
  orderNumber?: string;
  shopName?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83d\udce6 Commande r\u00e9cup\u00e9r\u00e9e !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Merci pour votre achat chez <strong>${data.shopName}</strong> ! Votre commande <strong>${data.orderNumber}</strong> a bien \u00e9t\u00e9 r\u00e9cup\u00e9r\u00e9e.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">N\u2019h\u00e9sitez pas \u00e0 laisser un avis pour aider les autres clients.</p>
    ${button(`${baseUrl}/commandes`, "Laisser un avis")}
  `);
}

export function stockIssue(data: {
  orderNumber?: string;
  shopName?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\u26a0\ufe0f Rupture de stock partielle</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Certains articles de votre commande <strong>${data.orderNumber}</strong> chez <strong>${data.shopName}</strong> ne sont plus disponibles.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Consultez votre commande pour choisir : continuer sans les articles manquants ou annuler.</p>
    ${button(`${baseUrl}/commandes`, "Voir ma commande")}
  `);
}

export function proValidated(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83c\udf1f Compte Pro valid\u00e9 !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      F\u00e9licitations ! Votre compte professionnel Klik&amp;Go a \u00e9t\u00e9 valid\u00e9 avec succ\u00e8s.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#047857;font-weight:600">Vos avantages Pro</p>
        <p style="margin:0;font-size:14px;color:#065f46">\u2022 Tarifs professionnels sur tous les produits<br>\u2022 Commandes en gros facilit\u00e9es<br>\u2022 Support prioritaire</p>
      </td></tr>
    </table>
    ${button(`${baseUrl}/decouvrir`, "Commander maintenant")}
  `);
}

export function proRejected(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">Demande Pro refus\u00e9e</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Votre demande de compte professionnel n\u2019a pas pu \u00eatre valid\u00e9e pour le moment.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Si vous pensez qu\u2019il s\u2019agit d\u2019une erreur, n\u2019h\u00e9sitez pas \u00e0 nous contacter.</p>
    ${button(`${baseUrl}/decouvrir`, "Retour \u00e0 l\u2019accueil")}
  `);
}
