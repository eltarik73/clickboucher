// src/app/(boucher)/boucher/commandes/use-order-actions.ts — the kitchen's order writes: the
// butcher actions (PATCH /api/boucher/orders/[id]/action) and the price adjustment
// (PATCH /api/orders/[id]/adjust-price), each followed by a re-read of the board and a toast.
"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { refusalMessage } from "@/lib/api/client-refusal";
import type { Serialized } from "@/lib/api/json";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import { stopOrderAlert } from "@/lib/sounds";
import type { AdjustPriceAnswer } from "@/lib/services/orders/adjust-price";
import type { BoucherAction } from "@/lib/services/orders/commands/action-schema";

const ACTION_LABELS: Record<BoucherAction["action"], string> = {
  accept: "Commande acceptee",
  deny: "Commande refusee",
  start_preparing: "Preparation lancee",
  mark_ready: "Commande prete !",
  confirm_pickup: "Retrait confirme",
  manual_pickup: "Retrait confirme",
  add_time: "Temps ajoute",
  item_unavailable: "Rupture signalee",
  cancel: "Commande annulee",
  add_note: "Note enregistrée",
};

/** What the kitchen says of a proposal the server took: applied, asked, or a replay of the order. */
function adjustmentNotice(answer: Serialized<AdjustPriceAnswer>): string {
  if (answer.applied) return "Prix mis à jour";
  return "_idempotent" in answer ? "Prix inchangé" : "Demande envoyée au client";
}

export function useOrderActions(refetch: () => Promise<void>) {
  // ── Handle order action (unified API) ──
  const handleAction = useCallback(
    async (orderId: string, action: BoucherAction) => {
      try {
        const res = await fetch(`/api/boucher/orders/${orderId}/action`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        if (res.ok) {
          // Stop marimba on accept/deny actions
          if (["accept", "deny", "cancel"].includes(action.action)) {
            stopOrderAlert();
          }
          await refetch();
          toast.success(ACTION_LABELS[action.action]);
        } else {
          const message = await refusalMessage(res, "Erreur lors de l'action");
          await refetch();
          toast.error(message);
        }
      } catch {
        toast.error("Erreur de connexion au serveur");
      }
    },
    [refetch]
  );

  // ── Handle price adjustment: true once the server took it (applied, or sent to the customer) ──
  const handleAdjustPrice = useCallback(
    async (orderId: string, data: AdjustPriceRequest) => {
      try {
        const res = await fetch(`/api/orders/${orderId}/adjust-price`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const json: { data: Serialized<AdjustPriceAnswer> } = await res.json();
          await refetch();
          toast.success(adjustmentNotice(json.data));
          return true;
        }
        toast.error(await refusalMessage(res, "Erreur lors de l'ajustement"));
      } catch {
        toast.error("Erreur de connexion au serveur");
      }
      return false;
    },
    [refetch]
  );

  return { handleAction, handleAdjustPrice };
}
