// src/app/(boucher)/boucher/commandes/use-order-actions.ts — the kitchen's order writes: the
// butcher actions (PATCH /api/boucher/orders/[id]/action) and the price adjustment
// (PATCH /api/orders/[id]/adjust-price), each followed by a re-read of the board and a toast.
"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { refusalMessage } from "@/lib/api/client-refusal";
import { stopOrderAlert } from "@/lib/sounds";
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

  // ── Handle price adjustment ──
  const handleAdjustPrice = useCallback(
    async (orderId: string, data: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/orders/${orderId}/adjust-price`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const json = await res.json();
          await refetch();
          if (json.data?.autoApproved) {
            toast.success("Prix ajusté automatiquement (baisse)");
          } else {
            toast.success("Ajustement envoyé — en attente du client (5 min)");
          }
        } else {
          toast.error(await refusalMessage(res, "Erreur lors de l'ajustement"));
        }
      } catch {
        toast.error("Erreur de connexion au serveur");
      }
    },
    [refetch]
  );

  return { handleAction, handleAdjustPrice };
}
