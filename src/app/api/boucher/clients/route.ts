// GET /api/boucher/clients — the shop's clients, most frequent first, aggregated by the database.
//
// A client is the person its orders name (order-person.ts): a users row, or for a guest order the
// identity typed at checkout. A guest order filed under a users row (an account whose e-mail was
// typed, or an earlier guest's) is never attributed to that row: it is listed under the identity
// typed, with no user id and no pro status, so the list never names an account holder who did not
// order here.
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import {
  orderClientKey,
  typedGuestPerson,
  type PersonName,
} from "@/lib/services/orders/order-person";

export const dynamic = "force-dynamic";

interface ClientTotals {
  key: string;
  userId: string;
  typed: PersonName | null;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: Date | null;
}

function latest(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

export async function GET(_req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const shop = await prisma.shop.findFirst({
      where: { id: shopId },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Aucune boucherie trouvée");
    }

    const url = new URL(_req.url);
    const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);

    // 1. Orders aggregated in the database by users row and identity typed (count, sum, last date).
    const groups = await prisma.order.groupBy({
      by: ["userId", "placedAsGuest", "customerFirstName", "customerLastName", "customerPhone"],
      where: { shopId: shop.id },
      _count: { _all: true },
      _sum: { totalCents: true },
      _max: { createdAt: true },
      orderBy: { _count: { userId: "desc" } },
      take: limit,
    });

    // 2. One entry per client: groups that name the same person are added up.
    const totals = new Map<string, ClientTotals>();
    for (const group of groups) {
      const key = orderClientKey(group);
      const entry = totals.get(key) ?? {
        key,
        userId: group.userId,
        typed: typedGuestPerson(group),
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: null,
      };
      entry.orderCount += group._count._all;
      entry.totalSpent += group._sum.totalCents ?? 0;
      entry.lastOrderDate = latest(entry.lastOrderDate, group._max.createdAt);
      totals.set(key, entry);
    }
    const entries = [...totals.values()].sort((a, b) => b.orderCount - a.orderCount);
    if (entries.length === 0) {
      return apiSuccess([]);
    }

    // 3. E-mail of every entry (the one typed for the order); names and pro access of users rows.
    const rowIds = entries.filter((entry) => entry.typed === null).map((entry) => entry.userId);
    const [users, proAccesses] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: [...new Set(entries.map((entry) => entry.userId))] } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.proAccess.findMany({
        where: { userId: { in: rowIds }, shopId: shop.id },
        select: { userId: true, status: true, companyName: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const proAccessMap = new Map(proAccesses.map((pa) => [pa.userId, pa]));

    const clients = entries.map((entry) => {
      const user = userMap.get(entry.userId);
      const proAccess = entry.typed === null ? proAccessMap.get(entry.userId) : undefined;
      const name = entry.typed ?? {
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
      };
      return {
        key: entry.key,
        userId: entry.typed === null ? entry.userId : null,
        firstName: name.firstName,
        lastName: name.lastName,
        email: user?.email ?? "",
        orderCount: entry.orderCount,
        totalSpent: entry.totalSpent,
        lastOrderDate: entry.lastOrderDate,
        proStatus: proAccess?.status ?? null,
        companyName: proAccess?.companyName ?? null,
      };
    });

    return apiSuccess(clients);
  } catch (error) {
    return handleApiError(error, "boucher-clients");
  }
}
