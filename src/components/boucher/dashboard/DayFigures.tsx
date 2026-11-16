// src/components/boucher/dashboard/DayFigures.tsx — the four figures of the butcher dashboard:
// revenue and orders of the day, orders waiting for an answer, rating of the shop.
import { Clock, DollarSign, Package, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DaySummary } from "./DaySummaryCard";
import type { ShopStatus } from "./ShopStatusBar";

interface DayFiguresProps {
  shop: ShopStatus | null;
  summary: DaySummary | null;
  pendingCount: number;
}

export function DayFigures({ shop, summary, pendingCount }: DayFiguresProps) {
  const caToday = (summary?.revenueTodayCents ?? 0) / 100;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">CA du jour</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {caToday.toFixed(2).replace(".", ",")} EUR
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Commandes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.ordersToday ?? 0}
          </p>
        </CardContent>
      </Card>

      <Card
        className={`border-0 shadow-sm ${pendingCount > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-white dark:bg-[#141414]"}`}
      >
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${pendingCount > 0 ? "bg-red-200 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}
            >
              <Clock
                className={`h-4 w-4 ${pendingCount > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">En attente</span>
          </div>
          <p
            className={`text-2xl font-bold ${pendingCount > 0 ? "text-red-600" : "text-gray-900 dark:text-white"}`}
          >
            {pendingCount}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Note</span>
          </div>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {shop?.rating.toFixed(1) || "—"}
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              /5 ({shop?.ratingCount || 0})
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
