import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "fail" | "skip"> = {};

  // DB ping
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {
    checks.db = "fail";
  }

  // Redis ping (skip if not configured)
  if (!redis.isAvailable) {
    checks.redis = "skip";
  } else {
    try {
      const raw = redis.raw;
      if (raw) {
        await raw.ping();
        checks.redis = "ok";
      } else {
        checks.redis = "skip";
      }
    } catch {
      checks.redis = "fail";
    }
  }

  const allOk = Object.values(checks).every((v) => v === "ok" || v === "skip");
  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      service: "clickboucher-api",
    },
    { status: allOk ? 200 : 503 }
  );
}
