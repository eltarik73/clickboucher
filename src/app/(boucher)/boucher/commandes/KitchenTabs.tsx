// src/app/(boucher)/boucher/commandes/KitchenTabs.tsx — the tab bar of the phone and tablet layout
// (below lg): Nouvelles | En cours | Prêtes | Historique, each with its count.
import { Bell, ChefHat, CheckCircle, ScrollText } from "lucide-react";

export type KitchenTab = "nouvelles" | "en-cours" | "pretes" | "historique";

const TABS: { key: KitchenTab; shortLabel: string; icon: typeof Bell }[] = [
  { key: "nouvelles", shortLabel: "Nouv.", icon: Bell },
  { key: "en-cours", shortLabel: "En cours", icon: ChefHat },
  { key: "pretes", shortLabel: "Prêtes", icon: CheckCircle },
  { key: "historique", shortLabel: "Histo.", icon: ScrollText },
];

type Props = {
  activeTab: KitchenTab;
  counts: Record<KitchenTab, number>;
  onSelect: (tab: KitchenTab) => void;
};

export default function KitchenTabs({ activeTab, counts, onSelect }: Props) {
  return (
    <div className="shrink-0 border-b border-white/5 bg-[#111] px-2 py-1.5 lg:hidden">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => onSelect(tab.key)}
              className={`flex min-h-[44px] flex-1 flex-shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition-all ${
                isActive ? "bg-[#DC2626] text-white" : "text-gray-500 hover:bg-white/5"
              }`}
            >
              <Icon size={14} />
              <span className="truncate">{tab.shortLabel}</span>
              {count > 0 && (
                <span
                  className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : tab.key === "nouvelles"
                        ? "bg-[#DC2626] text-white"
                        : "bg-white/10 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
