"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Check, Play } from "lucide-react";
import { refusalMessage } from "@/lib/api/client-refusal";
import { shopPublication, type ShopPublicationFacts } from "@/lib/shop-publication";

export type ModeratedShop = ShopPublicationFacts & {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  suspendReason: string | null;
  owner: { name: string; email: string } | null;
};

type Moderation =
  | { action: "validate"; body: { approved: true } }
  | { action: "suspend"; body: { suspended: boolean } };

const BUTTON =
  "inline-flex items-center gap-1.5 px-3 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors";

/**
 * Header of the admin shop page: the shop, whether Klik&Go suspended it and why, and the
 * moderation actions (validate a shop never published, suspend, reactivate a suspended shop).
 * After every attempt, accepted or refused, `onChanged` reloads the page data.
 */
export default function ShopModerationHeader({
  shop,
  onChanged,
}: {
  shop: ModeratedShop;
  onChanged: () => Promise<void>;
}) {
  const [acting, setActing] = useState(false);

  async function moderate({ action, body }: Moderation) {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/shops/${shop.id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) toast.error(await refusalMessage(res));
      await onChanged();
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">{shop.name}</h1>
          {shop.suspendedAt && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">
              Boutique suspendue
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {shop.address}, {shop.city} &middot; {shop.phone}
        </p>
        {shop.suspendedAt && shop.suspendReason && (
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
            Raison&nbsp;: {shop.suspendReason}
          </p>
        )}
        {shop.owner && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Propriétaire : {shop.owner.name} ({shop.owner.email})
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {shopPublication(shop) === "UNPUBLISHED" && (
          <button
            onClick={() => void moderate({ action: "validate", body: { approved: true } })}
            disabled={acting}
            className={`${BUTTON} bg-green-600 hover:bg-green-700`}
          >
            <Check size={14} /> Valider
          </button>
        )}
        {shop.suspendedAt ? (
          <button
            onClick={() => void moderate({ action: "suspend", body: { suspended: false } })}
            disabled={acting}
            className={`${BUTTON} bg-emerald-600 hover:bg-emerald-700`}
          >
            <Play size={14} /> Réactiver
          </button>
        ) : (
          <button
            onClick={() => void moderate({ action: "suspend", body: { suspended: true } })}
            disabled={acting}
            className={`${BUTTON} bg-red-600 hover:bg-red-700`}
          >
            <Ban size={14} /> Suspendre
          </button>
        )}
      </div>
    </div>
  );
}
