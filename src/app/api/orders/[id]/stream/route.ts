// GET /api/orders/[id]/stream — SSE for client-side order tracking
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastStatus = order.status;

  const stream = new ReadableStream({
    async start(controller) {
      // Initial event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED", orderId: id, status: lastStatus })}\n\n`)
      );

      const interval = setInterval(async () => {
        try {
          const current = await prisma.order.findUnique({
            where: { id },
            select: {
              status: true,
              estimatedReady: true,
              actualReady: true,
              pickedUpAt: true,
              denyReason: true,
              boucherNote: true,
            },
          });

          if (!current) {
            clearInterval(interval);
            controller.close();
            return;
          }

          // Emit status change
          if (current.status !== lastStatus) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "STATUS_CHANGED",
                  status: current.status,
                  estimatedReady: current.estimatedReady,
                  actualReady: current.actualReady,
                  pickedUpAt: current.pickedUpAt,
                  denyReason: current.denyReason,
                  boucherNote: current.boucherNote,
                })}\n\n`
              )
            );
            lastStatus = current.status;

            // Close stream if order is terminal
            const terminal = ["COMPLETED", "PICKED_UP", "DENIED", "CANCELLED", "AUTO_CANCELLED"];
            if (terminal.includes(current.status)) {
              clearInterval(interval);
              controller.close();
              return;
            }
          }

          // Heartbeat
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "HEARTBEAT", timestamp: Date.now() })}\n\n`
            )
          );
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 5000);
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
