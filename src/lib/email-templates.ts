// ─────────────────────────────────────────────
// HTML escape — prevent XSS in user-supplied fields
// ─────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
      <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
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
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\u2705 Commande acceptée !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Votre commande <strong>${data.orderNumber}</strong> chez <strong>${data.shopName}</strong> a été acceptée.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">\u23f1 Temps de préparation estimé</p>
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
    <p style="margin:0 0 4px;font-size:13px;color:#9ca3af">Présentez ce QR code au boucher lors du retrait.</p>
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
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83c\udf89 Votre commande est prête !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      La commande <strong>${data.orderNumber}</strong> est prête à retirer chez <strong>${data.shopName}</strong>.
    </p>
    ${data.qrCode ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#047857">QR Code de retrait</p>
        <p style="margin:0;font-size:16px;font-weight:600;font-family:monospace;color:#065f46;word-break:break-all">${data.qrCode}</p>
      </td></tr>
    </table>` : ""}
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Rendez-vous en boucherie avec votre QR code pour récupérer votre commande.</p>
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
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\u274c Commande refusée</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Désolé, votre commande <strong>${data.orderNumber}</strong> chez <strong>${data.shopName}</strong> n'a pas pu être acceptée.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#991b1b;font-weight:600">Raison</p>
        <p style="margin:0;font-size:14px;color:#7f1d1d">${esc(data.denyReason || "Non précisée")}</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280">Vous pouvez passer une nouvelle commande auprès d'une autre boucherie.</p>
    ${button(`${baseUrl}/decouvrir`, "Découvrir les boucheries")}
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
      Vous avez reçu une nouvelle commande <strong>#${data.orderNumber}</strong> de <strong>${esc(data.customerName || "un client")}</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Connectez-vous à votre espace boucher pour accepter ou refuser cette commande.</p>
    ${button(`${baseUrl}/boucher/commandes`, "Gérer les commandes")}
  `);
}

export function orderPickedUp(data: {
  orderNumber?: string;
  shopName?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83d\udce6 Commande récupérée !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Merci pour votre achat chez <strong>${data.shopName}</strong> ! Votre commande <strong>${data.orderNumber}</strong> a bien été récupérée.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">N'hésitez pas à laisser un avis pour aider les autres clients.</p>
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
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83c\udf1f Compte Pro validé !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Félicitations ! Votre compte professionnel Klik&amp;Go a été validé avec succès.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#047857;font-weight:600">Vos avantages Pro</p>
        <p style="margin:0;font-size:14px;color:#065f46">\u2022 Tarifs professionnels sur tous les produits<br>\u2022 Commandes en gros facilitées<br>\u2022 Support prioritaire</p>
      </td></tr>
    </table>
    ${button(`${baseUrl}/decouvrir`, "Commander maintenant")}
  `);
}

export function proRejected(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">Demande Pro refusée</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Votre demande de compte professionnel n'a pas pu être validée pour le moment.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Si vous pensez qu'il s'agit d'une erreur, n'hésitez pas à nous contacter.</p>
    ${button(`${baseUrl}/decouvrir`, "Retour à l'accueil")}
  `);
}

export function cartAbandoned(data: {
  shopName?: string;
  nbItems?: number;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83d\uded2 Votre panier vous attend !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Vous avez <strong>${data.nbItems || "des"} article(s)</strong> en attente chez <strong>${data.shopName || "votre boucherie"}</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Finalisez votre commande avant qu'il ne soit trop tard !</p>
    ${button(`${baseUrl}/panier`, "Voir mon panier")}
  `);
}

export function accountApproved(data: {
  shopName?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83c\udf89 Bienvenue sur Klik&amp;Go !</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Votre boutique <strong>${data.shopName || ""}</strong> est désormais activée sur Klik&amp;Go.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#047857;font-weight:600">Prochaines étapes</p>
        <p style="margin:0;font-size:14px;color:#065f46">\u2022 Ajoutez vos produits<br>\u2022 Configurez vos créneaux de retrait<br>\u2022 Commencez à recevoir des commandes !</p>
      </td></tr>
    </table>
    ${button(`${baseUrl}/boucher/dashboard`, "Accéder à mon espace")}
  `);
}

export function trialExpiring(data: {
  shopName?: string;
  message?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\u23f3 Votre essai se termine bientôt</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      ${data.message ? esc(data.message) : `L'essai gratuit de <strong>${esc(data.shopName || "votre boutique")}</strong> se termine dans 7 jours.`}
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Passez au paiement pour continuer à recevoir des commandes sans interruption.</p>
    ${button(`${baseUrl}/boucher/dashboard/abonnement`, "Gérer mon abonnement")}
  `);
}

export function weeklyReport(data: {
  shopName?: string;
  weeklyRevenue?: number;
  weeklyOrders?: number;
  weeklyAvgOrder?: number;
  weeklyRating?: number;
  weeklyTopProduct?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  const rev = ((data.weeklyRevenue || 0) / 100).toFixed(2);
  const avg = ((data.weeklyAvgOrder || 0) / 100).toFixed(2);
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">\ud83d\udcca Rapport hebdomadaire</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      Voici le résumé de la semaine pour <strong>${data.shopName || "votre boutique"}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="padding:12px 16px;background:#f9fafb;border-radius:8px 0 0 0;border-bottom:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#6b7280">Chiffre d'affaires</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827">${rev} €</p>
        </td>
        <td style="padding:12px 16px;background:#f9fafb;border-radius:0 8px 0 0;border-bottom:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#6b7280">Commandes</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827">${data.weeklyOrders || 0}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#f9fafb;border-radius:0 0 0 8px">
          <p style="margin:0;font-size:12px;color:#6b7280">Panier moyen</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827">${avg} €</p>
        </td>
        <td style="padding:12px 16px;background:#f9fafb;border-radius:0 0 8px 0">
          <p style="margin:0;font-size:12px;color:#6b7280">Note moyenne</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827">${data.weeklyRating?.toFixed(1) || "—"}/5</p>
        </td>
      </tr>
    </table>
    ${data.weeklyTopProduct ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#047857;font-weight:600">\ud83c\udfc6 Produit star de la semaine</p>
        <p style="margin:0;font-size:14px;color:#065f46;font-weight:600">${data.weeklyTopProduct}</p>
      </td></tr>
    </table>` : ""}
    <p style="margin:0;font-size:13px;color:#6b7280">Consultez vos statistiques détaillées dans votre espace boucher.</p>
    ${button(`${baseUrl}/boucher/dashboard/statistiques`, "Voir les statistiques")}
  `);
}

export function calendarAlert(data: {
  message?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.fr";
  return layout(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">📅 Événement à venir</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">
      ${esc(data.message || "Un événement important approche !")}
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280">Préparez vos produits et vos stocks pour répondre à la demande.</p>
    ${button(`${baseUrl}/boucher/dashboard`, "Mon tableau de bord")}
  `);
}
