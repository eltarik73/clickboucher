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
        vacationMode: true,
        vacationEnd: { not: null, lte: now },
      },
      data: {
        vacationMode: false,
        status: "OPEN",
        vacationStart: null,
        vacationEnd: null,
        vacationMessage: null,
      },
    });

    return apiSuccess({ reopenedCount: result.count, timestamp: now.toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/vacation-end");
  }
}
