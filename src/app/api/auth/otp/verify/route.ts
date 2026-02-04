import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyOtpSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, code } = verifyOtpSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return apiError("UNAUTHORIZED", "Aucun code OTP en attente pour ce numéro");
    }

    if (new Date() > user.otpExpiresAt) {
      return apiError("UNAUTHORIZED", "Code OTP expiré, demandez-en un nouveau");
    }

    if (user.otpCode !== code) {
      return apiError("UNAUTHORIZED", "Code OTP invalide");
    }

    // Clear OTP
    const updatedUser = await prisma.user.update({
      where: { phone },
      data: { otpCode: null, otpExpiresAt: null },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        proStatus: true,
        companyName: true,
      },
    });

    // In production: generate JWT token here
    // For mock: return user directly
    return apiSuccess({
      user: updatedUser,
      token: `mock_token_${updatedUser.id}_${Date.now()}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
