// src/app/api/boucher/orders/stream/route.ts — SSE real-time stream (Uber Eats WebSocket replacement)
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get boucher's shop
  const shop = await prisma.shop.findFirst({
    where: { ownerId: userId },
    select: { id: true, status: true },
  });
  if (!shop) {
    return new Response("Shop not found", { status: 404 });
  }

  const shopId = shop.id;
  const encoder = new TextEncoder();

  // Track last known state for change detection
  let lastPendingIds: string[] = [];
  let lastStatus = shop.status;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED", shopId })}\n\n`)
      );

      const interval = setInterval(async () => {
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

          // Update lastSeenAt
          await prisma.shop.update({
            where: { id: shopId },
            data: { lastSeenAt: new Date() },
          });
        } catch (e) {
          console.error("[SSE] Stream error:", (e as Error).message);
          clearInterval(interval);
          controller.close();
        }
      }, 3000); // Poll every 3s like Uber Eats internal

      // Cleanup on close
      const cleanup = () => clearInterval(interval);
      // AbortSignal doesn't apply here but interval is cleaned on error
      void cleanup;
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
