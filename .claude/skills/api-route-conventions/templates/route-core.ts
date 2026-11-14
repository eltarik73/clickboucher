// Destination : src/lib/api/route-core.ts (copie à l'identique).
// Moteur des route handlers Klik&Go : auth → rate limit → validation Zod → handler → erreurs.
//
// ⚠️ Ce module ne doit JAMAIS importer server-auth, boucher-auth ou admin-auth : les handlers
// exclus du matcher Clerk (crons, webhooks, health, geo…) l'utilisent via route-open.ts, et
// src/lib/__tests__/middleware-matcher.test.ts échoue si un helper Clerk entre dans leur
// fermeture d'imports. Les fabriques authentifiées vivent dans route-auth.ts.
import type { NextRequest } from "next/server";
import type { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { apiError, formatZodError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export type RateLimitName = keyof typeof rateLimits;

export interface RouteConfig {
  /** Nom stable de l'opération (« orders/accept »). Sert de tag Sentry, de clé de log et de préfixe de rate limit. */
  name: string;
  /** Limiteur de `rateLimits`. Clé : `${name}:${principal}` (shopId, clerkId…) ou l'IP si la route est ouverte. */
  rateLimit?: RateLimitName;
  /** Segments dynamiques de l'URL. Sans schéma : `Record<string, string>` brut. */
  params?: z.ZodTypeAny;
  /** Query string (`?a=1`). Sans schéma : `ctx.query` vaut `undefined`. */
  query?: z.ZodTypeAny;
  /** Corps JSON. Sans schéma : le corps n'est pas lu (webhooks, formData, flux). */
  body?: z.ZodTypeAny;
}

type Parsed<S, Fallback> = S extends z.ZodTypeAny ? z.output<S> : Fallback;

export interface RouteContext<TAuth, C extends RouteConfig> {
  req: NextRequest;
  auth: TAuth;
  params: Parsed<C["params"], Record<string, string>>;
  query: Parsed<C["query"], undefined>;
  body: Parsed<C["body"], undefined>;
  /** Identifiant de corrélation, renvoyé dans l'en-tête `x-request-id`. */
  requestId: string;
}

export type AuthOutcome<TAuth> = { ok: true; auth: TAuth } | { ok: false; response: Response };

export interface RouteKind<TAuth> {
  authenticate: (req: NextRequest) => Promise<AuthOutcome<TAuth>> | AuthOutcome<TAuth>;
  /** Identité stable du demandeur pour le rate limit ; `null` ⇒ adresse IP. */
  principal: (auth: TAuth) => string | null;
  /** `true` ⇒ la réponse peut dépendre du demandeur : jamais de cache partagé. */
  personalized: boolean;
}

/**
 * Signature exportée par un `route.ts`. `params` est un objet en Next 14 et une Promise à partir
 * de Next 15 : le moteur fait `await` dans les deux cas. Second argument optionnel pour les tests.
 */
export type RouteHandler = (req: NextRequest, segment?: { params?: unknown }) => Promise<Response>;

const PRIVATE_NO_STORE = "private, no-store";
const SHARED_CACHE_RE = /\b(public|s-maxage)\b/i;

/** IP du client. Sur Vercel, `x-forwarded-for` est réécrit par la plateforme (non falsifiable). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Réponse 429 uniforme avec `Retry-After` (secondes). `reset` = timestamp ms renvoyé par Upstash. */
export function tooManyRequests(
  rl?: { success: boolean; reset?: number },
  message = "Trop de requêtes, réessayez dans un instant"
): Response {
  const res = apiError("RATE_LIMITED", message);
  const seconds = typeof rl?.reset === "number" ? Math.ceil((rl.reset - Date.now()) / 1000) : 60;
  res.headers.set("Retry-After", String(Math.max(1, seconds)));
  return res;
}

/** Clé d'idempotence fournie par le client (`Idempotency-Key`), ou `null`. Bornée à 255 caractères. */
export function readIdempotencyKey(req: Request): string | null {
  const key = req.headers.get("idempotency-key")?.trim().replace(/^"|"$/g, "");
  return key && key.length <= 255 ? key : null;
}

const REQUEST_ID_RE = /^[\w.:-]{1,128}$/;

/**
 * `x-vercel-id` (posé par Vercel), sinon `x-request-id` de l'appelant, sinon un UUID.
 * Une valeur hors gabarit est ignorée : elle part dans un tag Sentry, un log et un en-tête de réponse.
 */
function getRequestId(req: Request): string {
  const candidate = req.headers.get("x-vercel-id") || req.headers.get("x-request-id");
  return candidate && REQUEST_ID_RE.test(candidate) ? candidate : globalThis.crypto.randomUUID();
}

type JsonRead = { ok: true; value: unknown } | { ok: false };

/** Corps vide ⇒ `undefined` (le schéma décide) ; JSON mal formé ⇒ échec (400, jamais 500). */
async function readJsonBody(req: Request): Promise<JsonRead> {
  try {
    const text = await req.text();
    return { ok: true, value: text.trim() === "" ? undefined : JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function finalize(
  res: Response,
  requestId: string,
  kind: { personalized: boolean },
  name: string
): Response {
  try {
    res.headers.set("x-request-id", requestId);
    if (kind.personalized) {
      const cacheControl = res.headers.get("Cache-Control");
      if (cacheControl && SHARED_CACHE_RE.test(cacheControl)) {
        logger.warn("[api] cache partagé refusé sur une route personnalisée", {
          route: name,
          cacheControl,
        });
      }
      if (!cacheControl || SHARED_CACHE_RE.test(cacheControl)) {
        res.headers.set("Cache-Control", PRIVATE_NO_STORE);
      }
    }
  } catch {
    // En-têtes immuables (Response.redirect, réponse relayée par fetch) : on renvoie tel quel.
  }
  return res;
}

/**
 * Crée une fabrique de handlers pour un type d'authentification.
 * Ordre garanti : authentification → rate limit → params → query → body → handler.
 * Toute exception aboutit à `handleApiError` (enveloppe 500 sans détail interne, Sentry).
 */
export function createRoute<TAuth>(kind: RouteKind<TAuth>) {
  return function route<C extends RouteConfig>(
    config: C,
    handler: (ctx: RouteContext<TAuth, C>) => Promise<Response> | Response
  ): RouteHandler {
    return async function routeHandler(req, segment) {
      // Hors du try, volontairement. Cette lecture de `req.headers` rend le handler dynamique :
      // sur un GET sans `dynamic = "force-dynamic"`, Next 14 lève ici pour sortir de la génération
      // statique, et l'erreur doit lui parvenir (dans le try, elle deviendrait une réponse 500).
      // Conséquence : `revalidate` n'a aucun effet sur un handler passé par une fabrique.
      const requestId = getRequestId(req);
      let res: Response;
      try {
        res = await run(req, segment, requestId);
      } catch (error) {
        res = Sentry.withScope((scope) => {
          scope.setTag("request_id", requestId);
          return handleApiError(error, config.name);
        });
      }
      if (res.status >= 500) {
        logger.warn("[api] réponse 5xx", {
          route: config.name,
          method: req.method,
          status: res.status,
          requestId,
        });
      }
      return finalize(res, requestId, kind, config.name);
    };

    async function run(
      req: NextRequest,
      segment: { params?: unknown } | undefined,
      requestId: string
    ) {
      const authn = await kind.authenticate(req);
      if (!authn.ok) return authn.response;

      if (config.rateLimit) {
        const who = kind.principal(authn.auth) ?? `ip:${clientIp(req)}`;
        const rl = await checkRateLimit(rateLimits[config.rateLimit], `${config.name}:${who}`);
        if (!rl.success) return tooManyRequests(rl);
      }

      const rawParams: unknown = (await segment?.params) ?? {};
      let params: unknown = rawParams;
      if (config.params) {
        const parsed = config.params.safeParse(rawParams);
        if (!parsed.success) {
          return apiError(
            "VALIDATION_ERROR",
            "Paramètres d'URL invalides",
            formatZodError(parsed.error)
          );
        }
        params = parsed.data;
      }

      let query: unknown = undefined;
      if (config.query) {
        const parsed = config.query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
        if (!parsed.success) {
          return apiError(
            "VALIDATION_ERROR",
            "Paramètres de requête invalides",
            formatZodError(parsed.error)
          );
        }
        query = parsed.data;
      }

      let body: unknown = undefined;
      if (config.body) {
        const json = await readJsonBody(req);
        if (!json.ok) return apiError("VALIDATION_ERROR", "Corps JSON invalide");
        const parsed = config.body.safeParse(json.value);
        if (!parsed.success) {
          return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
        }
        body = parsed.data;
      }

      const ctx = { req, auth: authn.auth, params, query, body, requestId } as RouteContext<
        TAuth,
        C
      >;
      return handler(ctx);
    }
  };
}
