"use client";

import { Card } from "@/components/ui/shared";

const WEEK_DATA = [
  { day: "Lun", value: 12 },
  { day: "Mar", value: 8 },
  { day: "Mer", value: 15 },
  { day: "Jeu", value: 22 },
  { day: "Ven", value: 18 },
  { day: "Sam", value: 25 },
  { day: "Dim", value: 14 },
];

const MAX = Math.max(...WEEK_DATA.map((d) => d.value));

export default function WebmasterStatsPage() {
  return (
    <div className="animate-fade-up">
      <Card className="p-6">
        <h3 className="font-display text-lg font-bold">Commandes cette semaine</h3>
        <div className="mt-5 flex items-end gap-2 h-[150px]">
          {WEEK_DATA.map((d, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1.5"
            >
              <span className="text-[10px] font-semibold text-stone-500">
                {d.value}
              </span>
              <div
                className="w-full rounded-t-lg animate-fade-up"
                style={{
                  height: `${(d.value / MAX) * 110}px`,
                  backgroundColor: i === 5 ? "#DC2626" : "#E7E5E4",
                  animationDelay: `${i * 70}ms`,
                } as React.CSSProperties}
              />
              <span className="text-[9px] text-stone-400">{d.day}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
