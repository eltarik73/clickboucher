// src/app/api/boucher/orders/stream/route.ts — SSE real-time stream (Uber Eats WebSocket replacement)
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await getAuthenticatedBoucher();
  if (authResult.error) return authResult.error;
  const { shopId } = authResult;

  // Get shop status for change detection
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { status: true },
  });
  if (!shop) {
    return new Response("Shop not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  // Track last known state for change detection
  let lastPendingIds: string[] = [];
  let lastStatus = shop.status;

  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED", shopId })}\n\n`)
      );

      interval = setInterval(async () => {
        try {
          // Fetch current state
          const [pendingOrders, currentShop] = await Promise.all([
            prisma.order.findMany({
              where: { shopId, status: "PENDING" },
              select: {
                id: true,
                orderNumber: true,
                totalCents: true,
                createdAt: true,
                expiresAt: true,
                customerNote: true,
                pickupSlotStart: true,
                pickupSlotEnd: true,
                items: {
                  select: { name: true, quantity: true, unit: true, priceCents: true },
                },
                user: { select: { firstName: true, lastName: true } },
              },
              orderBy: { createdAt: "desc" },
            }),
            prisma.shop.findUnique({
              where: { id: shopId },
              select: { status: true, busyMode: true, paused: true, autoPaused: true },
            }),
          ]);

          const currentPendingIds = pendingOrders.map((o) => o.id);

          // Detect new orders
          const newOrders = pendingOrders.filter(
            (o) => !lastPendingIds.includes(o.id)
          );

          // Send new order events
          for (const order of newOrders) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "NEW_ORDER", order })}\n\n`
              )
            );
          }

          // Detect status change
          if (currentShop && currentShop.status !== lastStatus) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "STATUS_CHANGED",
                  status: currentShop.status,
                  busyMode: currentShop.busyMode,
                  paused: currentShop.paused,
                  autoPaused: currentShop.autoPaused,
                })}\n\n`
              )
            );
            lastStatus = currentShop.status;
          }

          lastPendingIds = currentPendingIds;

          // Heartbeat
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "HEARTBEAT",
                timestamp: Date.now(),
                pendingCount: currentPendingIds.length,
              })}\n\n`
            )
          );

          // Update lastSeenAt via Redis (avoid DB write every poll)
          redis.set(`shop:lastSeen:${shopId}`, Date.now().toString(), { ex: 300 }).catch(() => {});
        } catch {
          if (interval) clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
        }
      }, 5000); // Poll every 5s (reduced from 3s to lower DB load)
    },
    cancel() {
      // Called when client disconnects — prevents interval leak
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
