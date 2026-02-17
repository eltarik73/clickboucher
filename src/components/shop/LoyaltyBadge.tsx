// src/components/shop/LoyaltyBadge.tsx — Loyalty progress on boutique page
"use client";

import { useState, useEffect } from "react";
import { Gift } from "lucide-react";

interface Props {
  shopId: string;
}

interface LoyaltyStatus {
  active: boolean;
  orderCount?: number;
  ordersRequired?: number;
  rewardPct?: number;
  rewardsEarned?: number;
  remaining?: number;
}

export function LoyaltyBadge({ shopId }: Props) {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);

  useEffect(() => {
    fetch(`/api/loyalty?shopId=${shopId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.success) setStatus(data.data);
      })
      .catch(() => {});
  }, [shopId]);

  if (!status || !status.active) return null;

  const { remaining, rewardPct, orderCount, ordersRequired, rewardsEarned } = status;
  const progress = ordersRequired ? ((ordersRequired! - remaining!) / ordersRequired!) * 100 : 0;

  return (
    <div className="mx-4 mb-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Gift size={18} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Encore {remaining} commande{remaining! > 1 ? "s" : ""} pour -{rewardPct}% !
          </p>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 bg-amber-200/50 dark:bg-amber-800/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
            {orderCount} / {ordersRequired} commandes
            {rewardsEarned! > 0 && (
              <span className="ml-1.5 font-semibold">
                ({rewardsEarned} recompense{rewardsEarned! > 1 ? "s" : ""} gagnee{rewardsEarned! > 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
