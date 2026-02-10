import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: string; latencyMs?: number; detail?: string }> = {};

  // ── Database ────────────────────────────────
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[health] DB check failed:", msg);
    checks.database = { status: "error", detail: msg };
  }

  // ── Services config ─────────────────────────
  checks.payment = {
    status: "ok",
    detail: `provider=${process.env.PAYMENT_PROVIDER || "mock"}`,
  };

  checks.notifications = {
    status: "ok",
    detail: `provider=${process.env.NOTIFICATION_PROVIDER || "stub"}`,
  };

  // ── Stats ───────────────────────────────────
  let stats = {};
  try {
    const [shops, orders, users] = await Promise.all([
      prisma.shop.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);
    stats = { shops, orders, users };
  } catch {
    stats = { error: "Could not fetch stats" };
  }

  // ── Env vars check ─────────────────────────
  const envCheck = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  };

  // ── Config ──────────────────────────────────
  const config = {
    weightTolerance: `±${process.env.WEIGHT_TOLERANCE_PERCENT || 10}%`,
    lastMinuteHold: `${process.env.LAST_MINUTE_HOLD_MINUTES || 10} min`,
    otpExpiry: `${process.env.OTP_EXPIRY_MINUTES || 5} min`,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptime: `${Math.round(process.uptime())}s`,
      latencyMs: Date.now() - start,
      checks,
      envCheck,
      stats,
      config,
    },
    { status: allOk ? 200 : 503 }
  );
}
