"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderQuote } from "@/lib/services/orders/quote";
import type { OrderQuoteRequest } from "@/lib/validators/order";

export type OrderQuoteState = "idle" | "loading" | "ready" | "error";

export interface OrderQuoteError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

interface QuoteResult {
  /** Serialized request the result answers; also the body that was sent. */
  key: string;
  quote: OrderQuote | null;
  error: OrderQuoteError | null;
}

const QUOTE_ENDPOINT = "/api/orders/quote";
const DEBOUNCE_MS = 400;
const NETWORK_ERROR: OrderQuoteError = {
  code: "NETWORK_ERROR",
  message: "Impossible de calculer le total. Vérifiez votre connexion puis réessayez.",
};
const UNEXPECTED_RESPONSE: OrderQuoteError = {
  code: "INTERNAL_ERROR",
  message: "Le total n'a pas pu être calculé. Réessayez dans un instant.",
};

function readError(body: unknown): OrderQuoteError {
  const error = (body as { error?: Partial<OrderQuoteError> } | null)?.error;
  if (error && typeof error.code === "string" && typeof error.message === "string") {
    return {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    };
  }
  return UNEXPECTED_RESPONSE;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/**
 * Server quote of the checkout. POST /api/orders/quote when the request changes,
 * debounced 400 ms, one request at a time (the previous one is aborted), stale answers
 * ignored, no polling, nothing sent while the request is null (empty cart).
 *
 * `quote` is only ever the answer to the CURRENT request: while a newer request is
 * pending, state is "loading" and quote is null, so a ready quote always matches the cart.
 */
export function useOrderQuote(request: OrderQuoteRequest | null): {
  state: OrderQuoteState;
  quote: OrderQuote | null;
  error: OrderQuoteError | null;
  refresh: () => Promise<void>;
} {
  const requestKey = request ? JSON.stringify(request) : null;
  const [result, setResult] = useState<QuoteResult | null>(null);
  const currentKeyRef = useRef<string | null>(requestKey);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchQuote = useCallback(async (key: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let outcome: QuoteResult;
    try {
      const res = await fetch(QUOTE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: key,
        signal: controller.signal,
      });
      const body = await readJson(res);
      const data = (body as { success?: boolean; data?: OrderQuote } | null)?.data;
      outcome =
        res.ok && data
          ? { key, quote: data, error: null }
          : { key, quote: null, error: readError(body) };
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!(error instanceof TypeError)) throw error;
      outcome = { key, quote: null, error: NETWORK_ERROR };
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
    if (controller.signal.aborted || currentKeyRef.current !== key) return;
    setResult(outcome);
  }, []);

  useEffect(() => {
    currentKeyRef.current = requestKey;
    if (!requestKey) {
      controllerRef.current?.abort();
      return;
    }
    const timer = setTimeout(() => {
      void fetchQuote(requestKey);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [requestKey, fetchQuote]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const refresh = useCallback(async () => {
    const key = currentKeyRef.current;
    if (!key) return;
    setResult((previous) => (previous?.key === key ? null : previous));
    await fetchQuote(key);
  }, [fetchQuote]);

  const current = requestKey && result?.key === requestKey ? result : null;
  const state: OrderQuoteState = !requestKey
    ? "idle"
    : !current
      ? "loading"
      : current.error
        ? "error"
        : "ready";

  return { state, quote: current?.quote ?? null, error: current?.error ?? null, refresh };
}
