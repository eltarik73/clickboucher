// src/lib/audit-log.ts — Global admin audit trail
import prisma from "@/lib/prisma";

interface AuditEntry {
  actorId: string;
  action: string;
  target?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

/**
 * Write an entry to the global audit log.
 * Fire-and-forget — never throws (logs errors to console).
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        target: entry.target,
        targetId: entry.targetId,
        details: entry.details ? (entry.details as object) : undefined,
        ip: entry.ip,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write:", err);
  }
}

/**
 * Query audit logs with filters and pagination.
 */
export async function queryAuditLogs(filters: {
  actorId?: string;
  action?: string;
  target?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  perPage?: number;
}) {
  const { actorId, action, target, targetId, from, to, page = 1, perPage = 50 } = filters;

  const where: Record<string, unknown> = {};
  if (actorId) where.actorId = actorId;
  if (action) where.action = action;
  if (target) where.target = target;
  if (targetId) where.targetId = targetId;
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: from }),
      ...(to && { lte: to }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, perPage };
}
