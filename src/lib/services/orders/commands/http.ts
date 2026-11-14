// src/lib/services/orders/commands/http.ts — the HTTP answer of an order command.
import type { Order } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { getStatusLabel } from "@/lib/order-state-machine";
import { customerOrderById } from "@/lib/services/orders/customer-view";
import type { CommandResult } from "./outcome";

/**
 * done = 200 with the data; replay = 200 with the current data and `_idempotent: true`;
 * conflict = 409 with the current status; not found = 404 (also for an order outside the
 * caller's scope); refused = the refusal's code.
 */
export function transitionResponse<T extends object>(result: CommandResult<T>) {
  switch (result.kind) {
    case "done":
      return apiSuccess(result.data);
    case "replay":
      return apiSuccess({ ...result.data, _idempotent: true });
    case "not_found":
      return apiError("NOT_FOUND", "Commande introuvable");
    case "conflict":
      return apiError(
        "CONFLICT",
        `Cette commande a changé d'état entre-temps (statut actuel : ${getStatusLabel(result.currentStatus)}).`,
        { currentStatus: [result.currentStatus] }
      );
    case "refused":
      return apiError(result.code, result.message, result.details);
  }
}

/**
 * transitionResponse for a customer's command: the order is answered in the customer view
 * (customer-view.ts), never as the raw row.
 */
export async function customerTransitionResponse(result: CommandResult<Order>) {
  if (result.kind !== "done" && result.kind !== "replay") return transitionResponse(result);
  return transitionResponse({ kind: result.kind, data: await customerOrderById(result.data.id) });
}
