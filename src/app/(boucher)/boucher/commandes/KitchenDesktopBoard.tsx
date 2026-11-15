// src/app/(boucher)/boucher/commandes/KitchenDesktopBoard.tsx — the desktop layout (lg and up):
// Nouvelles | En cours | Prêtes in three columns (two in simple mode), and the bottom bar that
// opens the history drawer.
import { Bell, ChefHat, CheckCircle, ScanLine, ScrollText } from "lucide-react";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import InProgressSplit from "./InProgressSplit";
import KitchenColumn, { type KitchenCardProps } from "./KitchenColumn";

type Props = KitchenCardProps & {
  simpleMode: boolean;
  pendingOrders: KitchenOrder[];
  inProgressOrders: KitchenOrder[];
  readyOrders: KitchenOrder[];
  historyCount: number;
  onAdjustPrice: (order: KitchenOrder) => void;
  onOpenScanner: () => void;
  onOpenHistory: () => void;
};

export default function KitchenDesktopBoard({
  simpleMode,
  pendingOrders,
  inProgressOrders,
  readyOrders,
  historyCount,
  onAdjustPrice,
  onOpenScanner,
  onOpenHistory,
  ...cardProps
}: Props) {
  const inProgressCount = inProgressOrders.length;
  const readyCount = readyOrders.length;

  return (
    <>
      <div className="hidden flex-1 overflow-hidden pb-14 lg:flex">
        {/* Column 1: Nouvelles */}
        <div className={simpleMode ? "w-[50%] shrink-0" : "w-[40%] shrink-0"}>
          <KitchenColumn
            title="Nouvelles"
            count={pendingOrders.length}
            icon={<Bell size={16} />}
            color="amber"
            orders={pendingOrders}
            {...cardProps}
            emptyMessage="Aucune nouvelle commande"
            emptyIcon={<Bell size={32} className="text-gray-700" />}
          />
        </div>

        {/* Divider */}
        {!simpleMode && <div className="w-px shrink-0 bg-white/5" />}

        {/* Column 2: En cours (flex-1) — split: À préparer + Programmées en attente */}
        {/* Hidden in simple mode */}
        {!simpleMode && (
          <div className="flex h-full min-w-0 flex-1 flex-col">
            {/* Column header */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 bg-[#111] px-3 py-2">
              <div className="rounded-md bg-blue-500/20 p-1 text-blue-400">
                <ChefHat size={16} />
              </div>
              <h2 className="text-xs font-bold text-white">En cours</h2>
              {inProgressCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[11px] font-bold text-white">
                  {inProgressCount}
                </span>
              )}
            </div>

            {/* Scrollable content — always split into 2 sections */}
            <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
              <InProgressSplit
                orders={inProgressOrders}
                {...cardProps}
                onAdjustPrice={onAdjustPrice}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        {!simpleMode && <div className="w-px shrink-0 bg-white/5" />}

        {/* Column 3: Prêtes (+ En cours in simple mode) */}
        <div className={simpleMode ? "w-[50%] shrink-0" : "w-1/5 shrink-0"}>
          <KitchenColumn
            title={simpleMode ? "En cours / Prêtes" : "Prêtes"}
            count={simpleMode ? inProgressCount + readyCount : readyCount}
            icon={<CheckCircle size={16} />}
            color="emerald"
            orders={simpleMode ? [...inProgressOrders, ...readyOrders] : readyOrders}
            {...cardProps}
            emptyMessage="Aucune commande prête"
            emptyIcon={<CheckCircle size={32} className="text-gray-700" />}
            extra={
              readyCount > 0 ? (
                <button
                  onClick={onOpenScanner}
                  className="mb-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#DC2626] py-3 font-bold text-white transition-all hover:bg-[#b91c1c] active:scale-95"
                >
                  <ScanLine size={16} /> Scanner QR
                </button>
              ) : null
            }
          />
        </div>
      </div>

      {/* ── Desktop bottom bar (Historique) ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 hidden h-14 items-center justify-center gap-4 border-t border-zinc-800 bg-zinc-900 px-6 lg:flex">
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-2 rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ScrollText size={16} />
          Historique
          {historyCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-gray-300">
              {historyCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
