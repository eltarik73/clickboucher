// ═══════════════════════════════════════════════
// CLICKBOUCHER — API Error Handling
// ═══════════════════════════════════════════════

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "WEIGHT_EXCEEDS_TOLERANCE"
  | "STOCK_INSUFFICIENT"
  | "SERVICE_DISABLED"
  | "CAPACITY_EXCEEDED"
  | "OFFER_EXPIRED"
  | "RESERVATION_EXPIRED"
  | "PAYMENT_FAILED"
  | "INTERNAL_ERROR";

interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, string[]>;
}

const STATUS_MAP: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  WEIGHT_EXCEEDS_TOLERANCE: 422,
  STOCK_INSUFFICIENT: 422,
  SERVICE_DISABLED: 503,
  CAPACITY_EXCEEDED: 429,
  OFFER_EXPIRED: 410,
  RESERVATION_EXPIRED: 410,
  PAYMENT_FAILED: 402,
  INTERNAL_ERROR: 500,
};

/**
 * Return a standardized error response
 */
export function apiError(code: ApiErrorCode, message: string, details?: Record<string, string[]>) {
  const status = STATUS_MAP[code] ?? 500;
  const body: { success: false; error: ApiError } = {
    success: false,
    error: { code, message, ...(details && { details }) },
  };
  return NextResponse.json(body, { status });
}

/**
 * Return a standardized success response
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Return a cached success response (public GET APIs)
 */
export function apiCached<T>(data: T, maxAge = 60) {
  return NextResponse.json(
    { success: true, data },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      },
    }
  );
}

/**
 * Return a paginated success response
 */
export function apiPaginated<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
}

/**
 * Format ZodError into a details object
 */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!details[path]) details[path] = [];
    details[path].push(issue.message);
  }
  return details;
}

/**
 * Wrap an API handler with try/catch + Zod validation error handling
 */
export function handleApiError(error: unknown, context?: string) {
  const prefix = context ? `[API Error][${context}]` : "[API Error]";

  if (error instanceof ZodError) {
    console.error(prefix, "Validation:", error.issues);
    return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(error));
  }

  if (error instanceof Error) {
    const msg = error.message;

    // DB connection / timeout errors (Railway)
    if (
      msg.includes("Can't reach database") ||
      msg.includes("Connection refused") ||
      msg.includes("Connection timed out") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("Connection pool timeout") ||
      msg.includes("Server has closed the connection") ||
      msg.includes("prepared statement")
    ) {
      console.error(prefix, "DB Connection Error:", msg);
      return apiError("INTERNAL_ERROR", "Erreur de connexion a la base de donnees");
    }

    // Prisma known errors
    if (msg.includes("Record to update not found") || msg.includes("Record to delete does not exist")) {
      console.error(prefix, "Not found:", msg);
      return apiError("NOT_FOUND", "Ressource introuvable");
    }
    if (msg.includes("Unique constraint")) {
      console.error(prefix, "Conflict:", msg);
      return apiError("CONFLICT", "Cette ressource existe déjà");
    }

    console.error(prefix, msg, error.stack);
  } else {
    console.error(prefix, "Unknown error:", error);
  }

  return apiError("INTERNAL_ERROR", "Erreur interne du serveur");
}
