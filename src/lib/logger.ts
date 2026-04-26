// src/lib/logger.ts — Structured logger with request correlation IDs
// Use this instead of console.log. Production emits JSON lines for ingestion.
/* eslint-disable no-console */
import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

type Level = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function normalizeContext(extras: unknown[]): LogContext | undefined {
  if (extras.length === 0) return undefined;
  if (extras.length === 1) {
    const c = extras[0];
    if (c == null) return undefined;
    if (c instanceof Error) {
      return {
        error: { name: c.name, message: c.message, stack: c.stack },
      };
    }
    if (typeof c === "object") return c as LogContext;
    return { value: c };
  }
  // Multiple extras — keep all (rest-args back-compat).
  return { extras };
}

function emit(level: Level, message: unknown, ...extras: unknown[]) {
  if (level === "debug" && isProd) return;

  // Back-compat: some legacy call sites pass a context object as the first arg.
  let msg: string;
  let extraArgs = extras;
  if (typeof message === "string") {
    msg = message;
  } else if (message instanceof Error) {
    msg = message.message;
    extraArgs = [message, ...extras];
  } else {
    msg = "(no message)";
    extraArgs = [message, ...extras];
  }

  const ctx = normalizeContext(extraArgs);
  const context = extraArgs.length === 1 ? extraArgs[0] : extraArgs;
  if (isProd) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      ...(ctx ? { context: ctx } : {}),
    };
    const fn = level === "debug" ? console.log : console[level];
    fn(JSON.stringify(entry));
  } else {
    const fn = level === "debug" ? console.log : console[level];
    if (ctx) {
      fn(`[${level.toUpperCase()}] ${msg}`, ctx);
    } else {
      fn(`[${level.toUpperCase()}] ${msg}`);
    }
  }

  if (level === "error" && process.env.SENTRY_DSN) {
    try {
      if (context instanceof Error) {
        Sentry.captureException(context, { extra: { message: msg } });
      } else {
        Sentry.captureMessage(msg, {
          level: "error",
          extra: ctx,
        });
      }
    } catch {
      // Sentry failures must never break logging
    }
  }
}

export const logger = {
  debug: (msg: unknown, ...extras: unknown[]) => emit("debug", msg, ...extras),
  info: (msg: unknown, ...extras: unknown[]) => emit("info", msg, ...extras),
  warn: (msg: unknown, ...extras: unknown[]) => emit("warn", msg, ...extras),
  error: (msg: unknown, ...extras: unknown[]) => emit("error", msg, ...extras),
};

// Extract or generate a correlation ID from an incoming Request.
// Pass through `x-request-id` if present, otherwise mint a fresh UUID.
export function withRequestId(req?: Request | { headers?: Headers } | null): string {
  try {
    const headers = (req as Request | undefined)?.headers;
    const existing = headers?.get?.("x-request-id");
    if (existing && existing.length > 0) return existing;
  } catch {
    // ignore
  }
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
