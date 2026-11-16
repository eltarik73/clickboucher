"use client";

import { useEffect, useState } from "react";
import type { OrderStatus } from "@prisma/client";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { trackedOrderFrom, type TrackedOrder } from "@/hooks/useOrderTracker";
import { refusalMessageOf } from "@/lib/api/client-refusal";
import { CUSTOMER_CANCEL_WINDOW_MS, isCancellable } from "@/lib/order-state-machine";

type CancelOutcome = { order: TrackedOrder } | { order: null; message: string };

async function requestCancel(orderId: string): Promise<CancelOutcome> {
  let res: Response;
  try {
    res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });
  } catch {
    return { order: null, message: "Erreur réseau, réessayez" };
  }
  const body: unknown = await res.json().catch(() => null);
  const order = res.ok ? trackedOrderFrom(body) : null;
  if (order) return { order };
  return { order: null, message: refusalMessageOf(body) ?? "Impossible d'annuler la commande" };
}

interface CancelOrderButtonProps {
  orderId: string;
  status: OrderStatus;
  /** ISO date the order was placed. */
  createdAt: string;
  /** The order as the server answers it once cancelled (customer view). */
  onCancelled: (order: TrackedOrder) => void;
}

/**
 * « Annuler la commande », shown while the member rule allows it (isCancellable). The server decides
 * in every case: a refusal shows its message.
 */
export default function CancelOrderButton({
  orderId,
  status,
  createdAt,
  onCancelled,
}: CancelOrderButtonProps) {
  // Decided after mount, because the rule reads the clock; asked again when the window closes.
  const [cancellable, setCancellable] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const placedAt = new Date(createdAt);
    const evaluate = () => setCancellable(isCancellable(status, placedAt));
    evaluate();
    const windowClosesIn = placedAt.getTime() + CUSTOMER_CANCEL_WINDOW_MS - Date.now();
    if (windowClosesIn <= 0) return;
    const timer = setTimeout(evaluate, windowClosesIn);
    return () => clearTimeout(timer);
  }, [status, createdAt]);

  async function cancel() {
    setPending(true);
    const outcome = await requestCancel(orderId);
    setPending(false);
    if (outcome.order === null) {
      toast.error(outcome.message);
      return;
    }
    onCancelled(outcome.order);
    toast.success("Commande annulée");
  }

  // A dialog the customer has opened stays until answered, even if the window closes meanwhile.
  if (!cancellable && !confirming) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        loading={pending}
        onClick={() => setConfirming(true)}
        className="w-full border-destructive text-destructive-text hover:bg-destructive-subtle"
      >
        {pending ? null : <XCircle className="mr-2 size-4" aria-hidden="true" />}
        Annuler la commande
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Annuler la commande ?"
        description="La boucherie sera prévenue. Vous ne pourrez pas revenir en arrière."
        confirmLabel="Oui, annuler"
        cancelLabel="Garder ma commande"
        variant="danger"
        onConfirm={() => void cancel()}
      />
    </>
  );
}
