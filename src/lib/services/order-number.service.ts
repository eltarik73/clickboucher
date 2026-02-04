// ═══════════════════════════════════════════════
// CLICKBOUCHER — Order Number Generator
// Format: CB-YYYYMMDD-XXX
// ═══════════════════════════════════════════════

import prisma from "@/lib/prisma";

export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `CB-${dateStr}-`;

  // Count today's orders to get next sequence
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400_000);

  const count = await prisma.order.count({
    where: {
      createdAt: { gte: startOfDay, lt: endOfDay },
    },
  });

  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}
