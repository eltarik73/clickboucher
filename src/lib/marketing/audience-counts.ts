// src/lib/marketing/audience-counts.ts — Audience segment counts for UI
import prisma from "@/lib/prisma";

export type AudienceCounts = {
  total: number;
  newClients: number;
  loyal: number;
  vip: number;
  inactive: number;
  butchersTotal: number;
  butchersNew: number;
  butchersActive: number;
};

export async function getAudienceCounts(): Promise<AudienceCounts> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Client segments — using raw query for efficiency
  const [total, segmentRows, inactive, butchersTotal, butchersNew, butchersActive] =
    await Promise.all([
      // Total clients
      prisma.user.count({ where: { role: "CLIENT" } }),

      // Segment counts via raw query
      prisma.$queryRaw<{ segment: string; cnt: bigint }[]>`
        SELECT
          CASE
            WHEN COALESCE(oc.cnt, 0) = 0 THEN 'NEW'
            WHEN COALESCE(oc.cnt, 0) < 5 THEN 'REGULAR'
            WHEN COALESCE(oc.cnt, 0) < 10 THEN 'LOYAL'
            ELSE 'VIP'
          END as segment,
          COUNT(*) as cnt
        FROM "users" u
        LEFT JOIN (
          SELECT "user_id", COUNT(*) as cnt
          FROM "orders"
          WHERE status IN ('COMPLETED', 'PICKED_UP')
          GROUP BY "user_id"
        ) oc ON oc."user_id" = u.id
        WHERE u.role = 'CLIENT'
        GROUP BY segment
      `,

      // Inactive (no order in 30 days)
      prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt FROM "users" u
        WHERE u.role = 'CLIENT'
        AND NOT EXISTS (
          SELECT 1 FROM "orders" o
          WHERE o."user_id" = u.id
          AND o."created_at" >= ${thirtyDaysAgo}
        )
        AND EXISTS (
          SELECT 1 FROM "orders" o2
          WHERE o2."user_id" = u.id
        )
      `,

      // Butcher counts
      prisma.shop.count({ where: { visible: true } }),
      prisma.shop.count({
        where: { visible: true, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.shop.count({
        where: {
          visible: true,
          orders: { some: { createdAt: { gte: thirtyDaysAgo } } },
        },
      }),
    ]);

  // Parse segment counts
  const segmentMap: Record<string, number> = {};
  for (const row of segmentRows) {
    segmentMap[row.segment] = Number(row.cnt);
  }

  return {
    total,
    newClients: segmentMap["NEW"] || 0,
    loyal: segmentMap["LOYAL"] || 0,
    vip: segmentMap["VIP"] || 0,
    inactive: Number(inactive[0]?.cnt || 0),
    butchersTotal,
    butchersNew,
    butchersActive,
  };
}
