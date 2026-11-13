// @security: test-only — Indique si le mode test est disponible et si une session
// de test VALIDE (jeton signé vérifié) est ouverte. Aucun secret exposé.

import { NextRequest, NextResponse } from "next/server";
import { getTestSecret, isTestMode } from "@/lib/auth/test-auth";
import { TEST_SESSION_COOKIE } from "@/lib/auth/test-session";
import { verifyTestSessionSync } from "@/lib/auth/test-session-node";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const enabled = isTestMode();
  const role = enabled
    ? verifyTestSessionSync(req.cookies.get(TEST_SESSION_COOKIE)?.value, getTestSecret())
    : null;
  return NextResponse.json({
    success: true,
    data: { enabled, activated: role !== null, role },
  });
}
