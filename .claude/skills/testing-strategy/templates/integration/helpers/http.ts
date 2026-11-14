// Destination : tests/integration/helpers/http.ts
import { NextRequest } from "next/server";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Requête telle que la reçoit un route handler App Router : on importe le handler et on l'appelle,
 * sans serveur. L'hôte est factice ; le chemin sert aux messages d'erreur et à req.nextUrl.
 */
export function apiRequest(method: Method, path: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(path, "http://localhost"), {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
