import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { sendOtpSchema } from "@/lib/validators";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = sendOtpSchema.parse(body);

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60_000); // 5 min

    // Upsert user (create if doesn't exist for guest checkout)
    await prisma.user.upsert({
      where: { phone },
      update: { otpCode: code, otpExpiresAt: expiresAt },
      create: { phone, otpCode: code, otpExpiresAt: expiresAt },
    });

    // STUB: In production, send via Twilio/WhatsApp
    console.log(`[STUB OTP] ${phone} → ${code} (expires ${expiresAt.toISOString()})`);

    return apiSuccess({
      message: "Code OTP envoyé",
      // ⚠️ Only expose code in dev/mock mode
      ...(process.env.NODE_ENV !== "production" && { debugCode: code }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
