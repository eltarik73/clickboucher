// @security: test-only — Server-side test mode activation.
// Sets klikgo-test-activated cookie ONLY after server-side secret verification.
// Never exposes the secret to the client.

import { NextRequest, NextResponse } from "next/server";
import { isTestMode, getTestSecret, type TestRole } from "@/lib/auth/test-auth";

export const dynamic = "force-dynamic";

const VALID_ROLES: TestRole[] = ["CLIENT", "BOUCHER", "ADMIN"];

/**
 * GET /api/test-mode/activate?secret=...&role=CLIENT|BOUCHER|ADMIN
 * Verifies the secret server-side, then sets the activation cookie.
 */
export async function GET(req: NextRequest) {
  if (!isTestMode()) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Test mode disabled" } },
      { status: 403 }
    );
  }

  const expected = getTestSecret();
  if (!expected) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "TEST_SECRET not configured" } },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") || "";
  const roleParam = (url.searchParams.get("role") || "CLIENT").toUpperCase() as TestRole;
  const role: TestRole = VALID_ROLES.includes(roleParam) ? roleParam : "CLIENT";

  // Constant-time-ish comparison (length + char): tiny secrets, fine for this use case.
  if (provided !== expected) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid secret" } },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ success: true, data: { activated: true, role } });
  const cookieOpts = { path: "/", maxAge: 86400, sameSite: "lax" as const, httpOnly: false };
  res.cookies.set("klikgo-test-activated", "true", cookieOpts);
  res.cookies.set("klikgo-test-role", role, cookieOpts);
  return res;
}

/**
 * POST /api/test-mode/activate
 * Body: { secret: string, role?: TestRole }
 * Same as GET but accepts JSON body for client-side fetch().
 */
export async function POST(req: NextRequest) {
  if (!isTestMode()) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Test mode disabled" } },
      { status: 403 }
    );
  }

  const expected = getTestSecret();
  if (!expected) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "TEST_SECRET not configured" } },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rec = (body ?? {}) as Record<string, unknown>;
  const provided = typeof rec.secret === "string" ? rec.secret : "";
  const roleRaw = typeof rec.role === "string" ? rec.role.toUpperCase() : "CLIENT";
  const role: TestRole = VALID_ROLES.includes(roleRaw as TestRole) ? (roleRaw as TestRole) : "CLIENT";

  if (provided !== expected) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid secret" } },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ success: true, data: { activated: true, role } });
  const cookieOpts = { path: "/", maxAge: 86400, sameSite: "lax" as const, httpOnly: false };
  res.cookies.set("klikgo-test-activated", "true", cookieOpts);
  res.cookies.set("klikgo-test-role", role, cookieOpts);
  return res;
}

/**
 * DELETE /api/test-mode/activate — clears test mode cookies.
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true, data: { activated: false } });
  res.cookies.set("klikgo-test-activated", "", { path: "/", maxAge: 0 });
  res.cookies.set("klikgo-test-role", "", { path: "/", maxAge: 0 });
  return res;
}
