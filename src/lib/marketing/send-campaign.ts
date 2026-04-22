// src/lib/marketing/send-campaign.ts — Core campaign email sending logic
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

// ── Build campaign HTML email ─────────────────────────────────
function buildCampaignHtml(campaign: {
  body: string;
  visualTitle?: string | null;
  visualSubtitle?: string | null;
  visualColor?: string | null;
  visualImageUrl?: string | null;
  offer?: { code: string; type: string; discountValue: number } | null;
}): string {
  const color = campaign.visualColor || "red";
  const hexColor = color === "red" ? "#DC2626" : color === "blue" ? "#3B82F6" : color === "green" ? "#10B981" : color === "orange" ? "#F97316" : color === "black" ? "#111827" : "#DC2626";

  let visualHtml = "";
  if (campaign.visualTitle || campaign.visualImageUrl) {
    const bgStyle = campaign.visualImageUrl
      ? `background:url(${campaign.visualImageUrl}) center/cover no-repeat;`
      : `background:${hexColor};`;
    visualHtml = `
      <tr>
        <td style="${bgStyle}padding:32px;text-align:center">
          ${campaign.visualTitle ? `<h2 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#ffffff">${campaign.visualTitle}</h2>` : ""}
          ${campaign.visualSubtitle ? `<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85)">${campaign.visualSubtitle}</p>` : ""}
        </td>
      </tr>`;
  }

  let promoHtml = "";
  if (campaign.offer) {
    const { code, type, discountValue } = campaign.offer;
    const label = type === "PERCENT" ? `-${discountValue}%` : type === "AMOUNT" ? `-${discountValue}€` : type === "FREE_DELIVERY" ? "Frais offerts" : type === "BOGO" ? "1+1 Offert" : `-${discountValue}€`;
    promoHtml = `
      <table cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%"><tr>
        <td style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;text-align:center">
          <p style="margin:0 0 6px;font-size:13px;color:#92400E;font-weight:600">🎁 ${label}</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#78350F;letter-spacing:2px;font-family:monospace">${code}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#A16207">Copiez ce code au moment du paiement</p>
        </td>
      </tr></table>`;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klikandgo.app";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
  <tr>
    <td style="background:#DC2626;padding:24px 32px;text-align:center">
      <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Klik&amp;Go</span>
    </td>
  </tr>
  ${visualHtml}
  <tr>
    <td style="padding:32px">
      <div style="font-size:15px;color:#374151;line-height:1.6">${campaign.body}</div>
      ${promoHtml}
      <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td>
        <a href="${baseUrl}/" style="display:inline-block;padding:12px 28px;background:#DC2626;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">Découvrir nos boucheries →</a>
      </td></tr></table>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">Klik&amp;Go — Click &amp; Collect Boucherie</p>
      <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Query recipients by audience segment ──────────────────────
async function getRecipients(audience: string): Promise<{ email: string }[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  switch (audience) {
    case "CLIENTS_ALL":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT email FROM "users" WHERE role = 'CLIENT' AND email IS NOT NULL
      `;

    case "CLIENTS_NEW":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT u.email FROM "users" u
        WHERE u.role = 'CLIENT' AND u.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "orders" o WHERE o."user_id" = u.id AND o.status IN ('COMPLETED','PICKED_UP')
        )
      `;

    case "CLIENTS_LOYAL":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT u.email FROM "users" u
        WHERE u.role = 'CLIENT' AND u.email IS NOT NULL
        AND (SELECT COUNT(*) FROM "orders" o WHERE o."user_id" = u.id AND o.status IN ('COMPLETED','PICKED_UP')) >= 5
      `;

    case "CLIENTS_INACTIVE":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT u.email FROM "users" u
        WHERE u.role = 'CLIENT' AND u.email IS NOT NULL
        AND EXISTS (SELECT 1 FROM "orders" o WHERE o."user_id" = u.id)
        AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."user_id" = u.id AND o."created_at" >= ${thirtyDaysAgo})
      `;

    case "BUTCHERS_ALL":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT DISTINCT u.email FROM "users" u
        INNER JOIN "shops" s ON (s."owner_id" = u."clerk_id" OR s."owner_id" = u.id)
        WHERE u.email IS NOT NULL AND s.visible = true
      `;

    case "BUTCHERS_NEW":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT DISTINCT u.email FROM "users" u
        INNER JOIN "shops" s ON (s."owner_id" = u."clerk_id" OR s."owner_id" = u.id)
        WHERE u.email IS NOT NULL AND s.visible = true AND s."created_at" >= ${thirtyDaysAgo}
      `;

    case "BUTCHERS_ACTIVE":
      return prisma.$queryRaw<{ email: string }[]>`
        SELECT DISTINCT u.email FROM "users" u
        INNER JOIN "shops" s ON (s."owner_id" = u."clerk_id" OR s."owner_id" = u.id)
        INNER JOIN "orders" o ON o."shop_id" = s.id AND o."created_at" >= ${thirtyDaysAgo}
        WHERE u.email IS NOT NULL AND s.visible = true
      `;

    default:
      return [];
  }
}

// ── Core send logic (used by API route + cron job) ────────────
export async function executeCampaignSend(campaignId: string): Promise<{ sent: number; total: number }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      offer: { select: { id: true, code: true, type: true, discountValue: true } },
    },
  });

  if (!campaign) throw new Error("Campagne introuvable");

  // Mark as SENDING
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  // Get recipients
  const recipients = await getRecipients(campaign.audience);
  const uniqueEmails = [...new Set(recipients.map((r) => r.email).filter(Boolean))];

  if (uniqueEmails.length === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SENT", sentAt: new Date(), sentCount: 0 },
    });
    return { sent: 0, total: 0 };
  }

  // Build HTML
  const html = buildCampaignHtml({
    body: campaign.body,
    visualTitle: campaign.visualTitle,
    visualSubtitle: campaign.visualSubtitle,
    visualColor: campaign.visualColor,
    visualImageUrl: campaign.visualImageUrl,
    offer: campaign.offer,
  });

  // Send emails in batches of 10
  let sentCount = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
    const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((email) => sendEmail(email, campaign.subject, html))
    );
    sentCount += results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  }

  // Mark as SENT with stats
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      sentCount,
    },
  });

  logger.info(`[campaign] Sent "${campaign.title}" to ${sentCount}/${uniqueEmails.length} recipients`);
  return { sent: sentCount, total: uniqueEmails.length };
}
