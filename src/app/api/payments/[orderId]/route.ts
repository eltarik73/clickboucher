import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";

export async function GET(
  _req: NextRequest,
  _context: { params: { orderId: string } }
) {
  return apiError("SERVICE_DISABLED", "Not implemented - schema migration pending");
}
