"use client";

// The weighing tolerance a signed-in customer saved (users.weigh_tolerance), shown and reused by
// the cart. Read from GET /api/users/me once the customer is signed in, never for an anonymous
// visitor (CLAUDE.md « Coût CPU Vercel » : no API call on mount for anonymous visitors). A failed
// read leaves the customer to choose, as if he had never chosen.

import { useEffect, useState } from "react";
import { WEIGH_TOLERANCE_CHOICES, type WeighToleranceChoice } from "@/lib/pricing/tolerance";

export interface SavedWeighTolerance {
  /** False while the saved choice of a signed-in customer is being read. */
  ready: boolean;
  saved: WeighToleranceChoice | null;
}

const NOTHING_SAVED: SavedWeighTolerance = { ready: true, saved: null };
const LOADING: SavedWeighTolerance = { ready: false, saved: null };

/** The saved choice in a `{ success: true, data }` answer of GET /api/users/me, or null. */
export function savedWeighToleranceFrom(body: unknown): WeighToleranceChoice | null {
  if (typeof body !== "object" || body === null) return null;
  const { success, data } = body as { success?: unknown; data?: unknown };
  if (success !== true || typeof data !== "object" || data === null) return null;
  const choice = (data as { weighTolerance?: unknown }).weighTolerance;
  return WEIGH_TOLERANCE_CHOICES.find((known) => known === choice) ?? null;
}

export function useSavedWeighTolerance(signedIn: boolean): SavedWeighTolerance {
  const [read, setRead] = useState<SavedWeighTolerance>(LOADING);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    const load = async () => {
      let saved: WeighToleranceChoice | null;
      try {
        const res = await fetch("/api/users/me", { signal: controller.signal });
        saved = res.ok ? savedWeighToleranceFrom(await res.json()) : null;
      } catch (error) {
        if (controller.signal.aborted) return;
        // Network failure or a body that is not JSON: the customer simply chooses.
        if (!(error instanceof TypeError) && !(error instanceof SyntaxError)) throw error;
        saved = null;
      }
      if (!controller.signal.aborted) setRead({ ready: true, saved });
    };
    void load();
    return () => controller.abort();
  }, [signedIn]);

  return signedIn ? read : NOTHING_SAVED;
}
