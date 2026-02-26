// GET  /api/webmaster/api-keys — List all API keys with stats
// POST /api/webmaster/api-keys — Generate a new API key
import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const AVAILABLE_SCOPES = [
  "orders:read",
  "orders:write",
  "products:read",
  "products:write",
  "shops:read",
  "customers:read",
  "analytics:read",
] as const;

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

// ── GET — List all keys ──
export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const keys = await prisma.apiKey.findMany({
      include: {
        shop: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Stats
    const totalKeys = keys.length;
    const activeKeys = keys.filter((k) => k.isActive).length;
    const expiredKeys = keys.filter(
      (k) => k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()
    ).length;
    const totalUsage = keys.reduce((sum, k) => sum + k.usageCount, 0);

    // Resolve creator names
    const creatorIds = [...new Set(keys.map((k) => k.createdBy))];
    const creators = await prisma.user.findMany({
      where: { clerkId: { in: creatorIds } },
      select: { clerkId: true, firstName: true, lastName: true },
    });
    const creatorMap = Object.fromEntries(
      creators.map((c) => [c.clerkId, `${c.firstName} ${c.lastName}`])
    );

    return apiSuccess({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        rateLimit: k.rateLimit,
        isActive: k.isActive,
        expiresAt: k.expiresAt,
        lastUsedAt: k.lastUsedAt,
        usageCount: k.usageCount,
        shop: k.shop,
        createdBy: creatorMap[k.createdBy] || k.createdBy,
        createdAt: k.createdAt,
      })),
      stats: { totalKeys, activeKeys, expiredKeys, totalUsage },
      availableScopes: AVAILABLE_SCOPES,
    });
  } catch (error) {
    return handleApiError(error, "webmaster/api-keys");
  }
}

// ── POST — Create new key ──
const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  shopId: z.string().optional(),
  scopes: z.array(z.string()).min(1),
  rateLimit: z.number().int().min(1).max(1000).optional().default(60),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = createKeySchema.parse(body);

    // Generate API key: klik_<32 random hex chars>
    const rawKey = `klik_${randomBytes(24).toString("hex")}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12); // "klik_xxxxxxx"

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86_400_000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: data.scopes,
        rateLimit: data.rateLimit,
        isActive: true,
        expiresAt,
        shopId: data.shopId || null,
        createdBy: admin.userId,
      },
    });

    await writeAuditLog({
      actorId: admin.userId,
      action: "apikey.create",
      target: "ApiKey",
      targetId: apiKey.id,
      details: { name: data.name, scopes: data.scopes, shopId: data.shopId },
    });

    // Return the raw key ONLY on creation (never stored in plain text)
    return apiSuccess(
      {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        keyPrefix,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      201
    );
  } catch (error) {
    return handleApiError(error, "webmaster/api-keys/create");
  }
}
