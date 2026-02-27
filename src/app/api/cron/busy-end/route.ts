import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = new Date();
    const result = await prisma.shop.updateMany({
      where: {
        busyMode: true,
        busyModeEndsAt: { not: null, lte: now },
      },
      data: { busyMode: false, busyModeEndsAt: null, status: "OPEN" },
    });

    return apiSuccess({ resetCount: result.count, timestamp: now.toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/busy-end");
  }
}
