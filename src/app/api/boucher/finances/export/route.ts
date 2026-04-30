// GET /api/boucher/finances/export?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Exporte un CSV des commandes payées sur la période demandée.
// Colonnes : Date, # commande, Client, Total, Commission Klik&Go, Frais service, Payout boucher, Méthode

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, handleApiError } from "@/lib/api/errors";

function escapeCsv(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  const str = String(s);
  if (/[",;\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function fmtEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { shopId } = auth;
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const now = new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toStr
      ? new Date(toStr + "T23:59:59")
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return apiError("VALIDATION_ERROR", "Dates invalides (format YYYY-MM-DD attendu)");
    }

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        paidAt: { gte: from, lte: to },
      },
      orderBy: { paidAt: "asc" },
      select: {
        orderNumber: true,
        displayNumber: true,
        totalCents: true,
        platformFeeCents: true,
        serviceFeeCents: true,
        stripeFeeCents: true,
        shopPayoutCents: true,
        paidAt: true,
        paymentMethod: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const headers = [
      "Date",
      "# Commande",
      "Client",
      "Email",
      "Total TTC (€)",
      "Commission Klik&Go (€)",
      "Frais service (€)",
      "Frais Stripe (€)",
      "Payout boucher (€)",
      "Méthode",
    ];

    const rows = orders.map((o) => [
      escapeCsv(o.paidAt ? o.paidAt.toISOString().slice(0, 10) : ""),
      escapeCsv(o.displayNumber || o.orderNumber),
      escapeCsv(
        o.user
          ? `${o.user.firstName.charAt(0).toUpperCase() + o.user.firstName.slice(1).toLowerCase()}.${o.user.lastName.charAt(0).toUpperCase()}`
          : "Client",
      ),
      escapeCsv(o.user?.email),
      fmtEuro(o.totalCents),
      fmtEuro(o.platformFeeCents),
      fmtEuro(o.serviceFeeCents),
      fmtEuro(o.stripeFeeCents),
      fmtEuro(o.shopPayoutCents),
      escapeCsv(o.paymentMethod),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    const filename = `klikgo-finances-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`;

    // BOM UTF-8 pour ouverture correcte dans Excel France
    const bom = "﻿";

    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err, "boucher/finances/export");
  }
}
