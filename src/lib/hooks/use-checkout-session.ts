"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { hasTestModeCookie } from "@/lib/test-mode-client";

/**
 * Who is checking out. ready = Clerk isLoaded OR test-mode cookie ;
 * signedIn = Clerk isSignedIn OR test-mode cookie.
 *
 * The cookie is read after mount: the server render and the first client render
 * both see "no test session", so hydration never mismatches.
 */
export function useCheckoutSession(): { ready: boolean; signedIn: boolean } {
  const { isLoaded, isSignedIn } = useAuth();
  const [testSession, setTestSession] = useState(false);

  useEffect(() => {
    setTestSession(hasTestModeCookie());
  }, []);

  return {
    ready: isLoaded || testSession,
    signedIn: (isLoaded && isSignedIn === true) || testSession,
  };
}
