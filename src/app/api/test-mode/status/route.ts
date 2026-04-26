// @security: test-only — Reports whether test mode is enabled and currently activated.
// No secret exposure. Public read of the cookie state.

import { NextRequest, NextResponse } from "next/server";
import { isTestMode } from "@/lib/auth/test-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const enabled = isTestMode();
  const activated = req.cookies.get("klikgo-test-activated")?.value === "true";
  const role = req.cookies.get("klikgo-test-role")?.value || null;
  return NextResponse.json({
    success: true,
    data: { enabled, activated, role },
  });
}
