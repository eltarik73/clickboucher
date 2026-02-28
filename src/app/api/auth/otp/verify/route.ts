import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { rateLimits, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit by IP to prevent OTP brute force
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(rateLimits.otpVerify, `otp-verify:${ip}`);
  if (!rl.success) {
    return apiError("RATE_LIMITED", "Trop de tentatives, réessayez dans 5 minutes");
  }

  return apiError("SERVICE_DISABLED", "Not implemented - schema migration pending");
}
