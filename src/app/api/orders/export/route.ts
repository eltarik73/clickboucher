export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { handleApiError } from "@/lib/api/errors";

const STATUS_FR: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptee",
  PREPARING: "En preparation",
  READY: "Prete",
  COMPLETED: "Terminee",
  PICKED_UP: "Recuperee",
  CANCELLED: "Annulee",
  DENIED: "Refusee",
  AUTO_CANCELLED: "Auto-annulee",
  PARTIALLY_DENIED: "Partiellement refusee",
};

// ── Shared: auth + query builder ──
async function getExportOrders(req: NextRequest) {
  const userId = await getServerUserId();
  if (!userId) throw new Error("UNAUTHORIZED");

  const user = await getOrCreateUser(userId);
  if (!user) throw new Error("NOT_FOUND");

  const role = user.role;
  const params = req.nextUrl.searchParams;
  const shopId = params.get("shopId");
  const from = params.get("from");
  const to = params.get("to");
  const statusFilter = params.get("status"); // comma-separated

  const where: Record<string, unknown> = {};
  let shopName = "";

  if (role === "ADMIN") {
    if (shopId) where.shopId = shopId;
  } else if (role === "BOUCHER") {
    const shops = await prisma.shop.findMany({
      where: { OR: [{ ownerId: userId }, { ownerId: user.id }] },
      select: { id: true, name: true },
    });
    const shopIds = shops.map((s) => s.id);
    where.shopId = shopId && shopIds.includes(shopId) ? shopId : { in: shopIds };
    shopName = shops[0]?.name || "";
  } else {
    throw new Error("FORBIDDEN");
  }

  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
  }

  if (statusFilter) {
    const statuses = statusFilter.split(",").filter(Boolean);
    if (statuses.length > 0) where.status = { in: statuses };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: { select: { name: true, unit: true } } } },
      shop: { select: { name: true } },
      user: { select: { firstName: true, lastName: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return { orders, shopName, from, to };
}

function formatOrderRow(order: { createdAt: Date; displayNumber: string | null; orderNumber: string; user: { firstName: string; lastName: string; phone: string | null; email: string | null } | null; shop: { name: string } | null; status: string; items: { quantity: number; name: string; product: { name: string; unit: string } | null }[]; totalCents: number; paymentMethod: string; customerNote: string | null }) {
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString("fr-FR");
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const clientName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : "Inconnu";
  const articles = order.items
    .map((i) => `${i.quantity}x ${i.product?.name || i.name}`)
    .join(", ");
  const total = (order.totalCents / 100).toFixed(2).replace(".", ",");
  const payment = order.paymentMethod === "ONLINE" ? "En ligne" : "Sur place";

  return {
    numero: order.displayNumber || order.orderNumber,
    dateStr,
    timeStr,
    clientName,
    phone: order.user?.phone || "",
    email: order.user?.email || "",
    shopName: order.shop?.name || "",
    status: STATUS_FR[order.status] || order.status,
    articles,
    total,
    payment,
    note: (order.customerNote || "").replace(/[\r\n;]/g, " "),
  };
}

// ── GET /api/orders/export?format=csv|print ──
export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get("format") || "csv";

    const { orders, shopName, from, to } = await getExportOrders(req);

    // ── Print format: return HTML page ──
    if (format === "print") {
      const rows = orders.map(formatOrderRow);
      const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
      const totalEur = (totalCents / 100).toFixed(2).replace(".", ",");
      const periodLabel = from && to ? `Du ${new Date(from).toLocaleDateString("fr-FR")} au ${new Date(to).toLocaleDateString("fr-FR")}` : "Toutes les commandes";

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Export commandes - ${shopName || "Klik&Go"}</title>
<style>
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
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
    table { font-size: 10px; }
    th, td { padding: 5px 6px; }
  }
</style>
</head>
<body>
<div class="no-print" style="margin-bottom:16px;text-align:center;">
  <button onclick="window.print()" style="padding:10px 28px;background:#DC2626;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Imprimer / Sauvegarder PDF</button>
</div>
<div class="header">
  <div class="logo">
    <div class="logo-circle">K</div>
    <div class="logo-text">Klik&Go</div>
  </div>
  <div class="meta">
    <strong>${shopName || "Export commandes"}</strong>
    ${periodLabel}<br>
    Export du ${new Date().toLocaleDateString("fr-FR")} a ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
  </div>
</div>
<div class="summary">
  <div class="summary-card"><div class="label">Commandes</div><div class="value">${orders.length}</div></div>
  <div class="summary-card"><div class="label">CA Total</div><div class="value">${totalEur} &euro;</div></div>
  <div class="summary-card"><div class="label">Panier moyen</div><div class="value">${orders.length > 0 ? (totalCents / orders.length / 100).toFixed(2).replace(".", ",") : "0,00"} &euro;</div></div>
</div>
<table>
<thead><tr>
  <th>N°</th><th>Date</th><th>Heure</th><th>Client</th><th>Tel.</th><th>Statut</th><th>Articles</th><th class="text-right">Total</th><th>Paiement</th>
</tr></thead>
<tbody>
${rows.map((r) => `<tr><td>${r.numero}</td><td>${r.dateStr}</td><td>${r.timeStr}</td><td>${r.clientName}</td><td>${r.phone}</td><td>${r.status}</td><td>${r.articles}</td><td class="text-right">${r.total} &euro;</td><td>${r.payment}</td></tr>`).join("\n")}
</tbody>
</table>
<div class="footer">&copy; ${new Date().getFullYear()} Klik&Go &mdash; Export automatique</div>
</body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ── CSV format (default) ──
    const BOM = "\uFEFF";
    const SEP = ";";
    const headers = ["Numero", "Date", "Heure", "Client", "Telephone", "Email", "Boucherie", "Statut", "Articles", "Total (EUR)", "Paiement", "Note client"];

    const csvRows = orders.map((order) => {
      const r = formatOrderRow(order);
      return [r.numero, r.dateStr, r.timeStr, r.clientName, r.phone, r.email, r.shopName, r.status, r.articles, r.total, r.payment, r.note];
    });

    const csvContent =
      BOM +
      headers.join(SEP) +
      "\n" +
      csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(SEP)).join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Non autorise" }, { status: 401 });
      if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Acces reserve aux bouchers" }, { status: 403 });
    }
    return handleApiError(error, "orders/export");
  }
}
