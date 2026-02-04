import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { paymentService } from "@/lib/services";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const payment = await paymentService.getPaymentStatus(params.orderId);
    if (!payment) return apiError("NOT_FOUND", "Paiement introuvable");
    return apiSuccess(payment);
  } catch (error) {
    return handleApiError(error);
  }
}
