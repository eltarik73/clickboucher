export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { handleApiError } from "@/lib/api/errors";

// ── GET /api/orders/export?format=csv ──
// Boucher: exports their shop orders as CSV
// Admin: exports all orders (optionally filtered by shopId)
export async function GET(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const user = await getOrCreateUser(userId);
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const role = user.role;
    const params = req.nextUrl.searchParams;
    const shopId = params.get("shopId");
    const from = params.get("from");
    const to = params.get("to");

    const where: Record<string, unknown> = {};

    if (role === "ADMIN") {
      if (shopId) where.shopId = shopId;
    } else if (role === "BOUCHER") {
      const shops = await prisma.shop.findMany({
        where: { OR: [{ ownerId: userId }, { ownerId: user.id }] },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);
      where.shopId = shopId && shopIds.includes(shopId) ? shopId : { in: shopIds };
    } else {
      return NextResponse.json({ error: "Acces reserve aux bouchers" }, { status: 403 });
    }

    // Date filters
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
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

    // Build CSV
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel
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

    const STATUS_FR: Record<string, string> = {
      PENDING: "En attente",
      ACCEPTED: "Acceptee",
      PREPARING: "En preparation",
      READY: "Prete",
      COMPLETED: "Terminee",
      PICKED_UP: "Recuperee",
      CANCELLED: "Annulee",
      DENIED: "Refusee",
    };

    const rows = orders.map((order) => {
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

      return [
        order.displayNumber || order.orderNumber,
        dateStr,
        timeStr,
        clientName,
        order.user?.phone || "",
        order.user?.email || "",
        order.shop?.name || "",
        STATUS_FR[order.status] || order.status,
        articles,
        total,
        payment,
        (order.customerNote || "").replace(/[\r\n;]/g, " "),
      ];
    });

    const csvContent =
      BOM +
      headers.join(SEP) +
      "\n" +
      rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(SEP)).join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error, "orders/export");
  }
}
