// src/lib/cron-auth.ts — Shared auth for Vercel Cron routes
import { NextRequest } from "next/server";

/**
 * Validates cron request auth.
 * Supports both Vercel Crons (Authorization: Bearer <secret>) and
 * custom header (x-cron-secret: <secret>).
 */
export function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Crons send Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Legacy: custom x-cron-secret header
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret === secret) return true;

  return false;
}
