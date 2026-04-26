import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import type { User } from "@prisma/client";

export const GUEST_COOKIE_NAME = "klikgo-guest-token";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Resolve the current visitor as a guest User (clerkId=null) via httpOnly cookie.
 * Returns null when no cookie is set or token is invalid / has been claimed.
 */
export async function getGuestUser(): Promise<User | null> {
  const token = cookies().get(GUEST_COOKIE_NAME)?.value;
  if (!token) return null;

  // Only treat as guest if clerkId is still null. A user that has since
  // signed up should go through the normal Clerk flow.
  return prisma.user.findFirst({
    where: { guestToken: token, clerkId: null },
  });
}

/**
 * Set the guest cookie on a NextResponse (httpOnly, lax, 30 days).
 * Pass the token returned from creating the guest User.
 */
export function setGuestCookie(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
  token: string
) {
  response.cookies.set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
}
