export const dynamic = "force-dynamic";

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { handleApiError } from "@/lib/api/errors";
import { csvLine } from "@/lib/csv";
import { orderPerson, type OrderPersonColumns } from "@/lib/services/orders/order-person";
import { buildOrdersPrintDocument } from "./print-document";

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

function formatOrderRow(
  order: OrderPersonColumns & {
    createdAt: Date;
    displayNumber: string | null;
    orderNumber: string;
    user: { firstName: string; lastName: string; phone: string | null; email: string };
    shop: { name: string } | null;
    status: string;
    items: { quantity: number; name: string; product: { name: string; unit: string } | null }[];
    totalCents: number;
    paymentMethod: string;
    customerNote: string | null;
  }
) {
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString("fr-FR");
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const person = orderPerson(order);
  const clientName = `${person.firstName} ${person.lastName}`;
  const articles = order.items.map((i) => `${i.quantity}x ${i.product?.name || i.name}`).join(", ");
  const total = (order.totalCents / 100).toFixed(2).replace(".", ",");
  const payment = order.paymentMethod === "ONLINE" ? "En ligne" : "Sur place";

  return {
    numero: order.displayNumber || order.orderNumber,
    dateStr,
    timeStr,
    clientName,
    phone: person.phone ?? "",
    email: order.user.email,
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

    // ── Print format: an HTML page, every value escaped, one nonce'd script ──
    if (format === "print") {
      const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
      const exportedAt = new Date();
      const scriptNonce = randomBytes(16).toString("base64");
      const page = buildOrdersPrintDocument({
        shopName,
        periodLabel:
          from && to
            ? `Du ${new Date(from).toLocaleDateString("fr-FR")} au ${new Date(to).toLocaleDateString("fr-FR")}`
            : "Toutes les commandes",
        exportedAtLabel: `${exportedAt.toLocaleDateString("fr-FR")} à ${exportedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        rows: orders.map(formatOrderRow),
        orderCount: orders.length,
        totalEur: (totalCents / 100).toFixed(2).replace(".", ","),
        averageEur:
          orders.length > 0
            ? (totalCents / orders.length / 100).toFixed(2).replace(".", ",")
            : "0,00",
        year: exportedAt.getFullYear(),
        scriptNonce,
      });

      return new NextResponse(page.value, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; base-uri 'none'; form-action 'none'`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // ── CSV format (default) ──
    const BOM = "\uFEFF";
    const SEP = ";";
    const headers = [
      "Numero",
      "Date",
      "Heure",
      "Client",
      "Telephone",
      "Email",
      "Boucherie",
      "Statut",
      "Articles",
      "Total (EUR)",
      "Paiement",
      "Note client",
    ];

    const csvRows = orders.map((order) => {
      const r = formatOrderRow(order);
      return [
        r.numero,
        r.dateStr,
        r.timeStr,
        r.clientName,
        r.phone,
        r.email,
        r.shopName,
        r.status,
        r.articles,
        r.total,
        r.payment,
        r.note,
      ];
    });

    const csvContent =
      BOM +
      headers.join(SEP) +
      "\n" +
      csvRows.map((row) => csvLine(row, SEP)).join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ error: "Non autorise" }, { status: 401 });
      if (error.message === "NOT_FOUND")
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Acces reserve aux bouchers" }, { status: 403 });
    }
    return handleApiError(error, "orders/export");
  }
}
