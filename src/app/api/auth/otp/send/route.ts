import { NextRequest } from "next/server";
import { apiError, handleApiError } from "@/lib/api/errors";
import { rateLimits, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP to prevent OTP spam
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(rateLimits.otpSend, `otp-send:${ip}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de tentatives, réessayez dans 1 minute");
    }

    return apiError("SERVICE_DISABLED", "Not implemented - schema migration pending");
  } catch (error) {
    return handleApiError(error, "auth/otp/send");
  }
}
