// GET /suivi/<id>/acces/<token> — the link of the confirmation e-mail (public: the token is the proof).
// A live credential of this order is moved into the order's httpOnly cookie, then the browser is
// sent to /suivi/<id>, so the token leaves the address bar at once and is never in a query string.
// An invalid or expired token gets the same redirect without a cookie: the page then treats the
// visitor like anyone without access. No-store and no-referrer keep the token out of caches and of
// the Referer of the next request.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { verifyOrderCredential } from "@/lib/auth/order-access";
import { orderPagePath, setOrderAccessCookie } from "@/lib/auth/order-credential";

export async function GET(req: NextRequest, { params }: { params: { id: string; token: string } }) {
  try {
    const order = await verifyOrderCredential(params.id, params.token);
    const response = NextResponse.redirect(new URL(orderPagePath(params.id), req.url), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    if (order) setOrderAccessCookie(response.cookies, order, params.token);
    return response;
  } catch (error) {
    return handleApiError(error, "suivi/[id]/acces GET");
  }
}
