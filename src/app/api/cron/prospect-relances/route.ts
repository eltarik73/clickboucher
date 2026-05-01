// src/app/api/cron/prospect-relances/route.ts
// Daily cron: send 3-day & 7-day relance emails to CONTACTED prospects.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { prospectRelance3j, prospectRelance7j } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = Date.now();
    // Window for relance_3j: lastEmailAt is between 3d and 4d ago
    const threeDaysAgoMin = new Date(now - 4 * DAY_MS);
    const threeDaysAgoMax = new Date(now - 3 * DAY_MS);
    // Window for relance_7j: lastEmailAt is between 7d and 8d ago
    const sevenDaysAgoMin = new Date(now - 8 * DAY_MS);
    const sevenDaysAgoMax = new Date(now - 7 * DAY_MS);

    const candidates = await prisma.prospect.findMany({
      where: {
        status: "CONTACTED",
        email: { not: null },
        emailsSentCount: { in: [1, 2] },
        OR: [
          { lastEmailAt: { gte: threeDaysAgoMin, lte: threeDaysAgoMax } },
          { lastEmailAt: { gte: sevenDaysAgoMin, lte: sevenDaysAgoMax } },
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
        email: true,
        emailsSentCount: true,
        lastEmailAt: true,
      },
    });

    let relance3jSent = 0;
    let relance7jSent = 0;

    for (const p of candidates) {
      if (!p.email || !p.lastEmailAt) continue;
      const ageMs = now - p.lastEmailAt.getTime();
      const data = { name: p.name, city: p.city };

      if (p.emailsSentCount === 1 && ageMs >= 3 * DAY_MS && ageMs < 4 * DAY_MS) {
        const ok = await sendEmail(
          p.email,
          "Re: Klik&Go — Une rapide question pour votre boucherie",
          prospectRelance3j(data)
        );
        if (ok) {
          await prisma.prospect.update({
            where: { id: p.id },
            data: { emailsSentCount: { increment: 1 }, lastEmailAt: new Date() },
          });
          relance3jSent++;
        }
      } else if (p.emailsSentCount === 2 && ageMs >= 7 * DAY_MS && ageMs < 8 * DAY_MS) {
        const ok = await sendEmail(
          p.email,
          `Dernière relance — Klik&Go pour ${p.city || "votre boucherie"}`,
          prospectRelance7j(data)
        );
        if (ok) {
          await prisma.prospect.update({
            where: { id: p.id },
            data: { emailsSentCount: { increment: 1 }, lastEmailAt: new Date() },
          });
          relance7jSent++;
        }
      }
    }

    return apiSuccess({
      relance3jSent,
      relance7jSent,
      candidatesScanned: candidates.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/prospect-relances");
  }
}
