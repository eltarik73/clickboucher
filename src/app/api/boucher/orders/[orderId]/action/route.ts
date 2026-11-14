// src/app/api/boucher/orders/[orderId]/action/route.ts — the butcher's actions on an order (kitchen
// tablet). The route authenticates, parses and maps the result; each action is a command of
// src/lib/services/orders/commands, which owns the status rules.
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { handleApiError } from "@/lib/api/errors";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import {
  boucherActionSchema,
  type BoucherAction,
} from "@/lib/services/orders/commands/action-schema";
import { cancelOrderByShop, denyOrder } from "@/lib/services/orders/commands/close";
import { transitionResponse } from "@/lib/services/orders/commands/http";
import type { CommandResult } from "@/lib/services/orders/commands/outcome";
import {
  addNote,
  addTime,
  confirmPickup,
  markReady,
  startPreparing,
} from "@/lib/services/orders/commands/progress";
import { reportUnavailableItems } from "@/lib/services/orders/commands/unavailable";

export const dynamic = "force-dynamic";

interface ActionContext {
  orderId: string;
  shopId: string;
  actorId: string;
  now: Date;
}

function runAction(action: BoucherAction, ctx: ActionContext): Promise<CommandResult<object>> {
  switch (action.action) {
    case "accept":
      return acceptOrder({ ...ctx, estimatedMinutes: action.estimatedMinutes });
    case "deny":
      return denyOrder({ ...ctx, reason: action.reason });
    case "start_preparing":
      return startPreparing({ ...ctx, addMinutes: action.addMinutes });
    case "add_time":
      return addTime({ ...ctx, addMinutes: action.addMinutes });
    case "mark_ready":
      return markReady(ctx);
    case "item_unavailable":
      return reportUnavailableItems({ ...ctx, productIds: action.itemIds });
    case "confirm_pickup":
      return confirmPickup({ ...ctx, target: { orderId: ctx.orderId, qrCode: action.qrCode } });
    case "manual_pickup":
      return confirmPickup({ ...ctx, target: { orderId: ctx.orderId, qrCode: null } });
    case "cancel":
      return cancelOrderByShop({ ...ctx, reason: action.reason });
    case "add_note":
      return addNote({ ...ctx, note: action.note });
  }
}

// ── PATCH /api/boucher/orders/[orderId]/action ──
export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;

    const action = boucherActionSchema.parse(await req.json());
    const result = await runAction(action, {
      orderId: params.orderId,
      shopId: authResult.shopId,
      actorId: authResult.userId,
      now: new Date(),
    });
    return transitionResponse(result);
  } catch (error) {
    return handleApiError(error, "boucher/orders/action");
  }
}
