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
export function handleApiError(error: unknown) {
  console.error("[API Error]", error);

  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(error));
  }

  if (error instanceof Error) {
    // Prisma known errors
    if (error.message.includes("Record to update not found")) {
      return apiError("NOT_FOUND", "Ressource introuvable");
    }
    if (error.message.includes("Unique constraint")) {
      return apiError("CONFLICT", "Cette ressource existe déjà");
    }
  }

  return apiError("INTERNAL_ERROR", "Erreur interne du serveur");
}
