"use client";

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
const TOTAL = WEEK_DATA.reduce((s, d) => s + d.value, 0);

const SUMMARY = [
  { label: "Total semaine", value: String(TOTAL), color: "text-[#DC2626]" },
  { label: "Moy. / jour", value: (TOTAL / 7).toFixed(1), color: "text-blue-600 dark:text-blue-400" },
  { label: "Pic", value: `${MAX} (Sam)`, color: "text-emerald-600 dark:text-emerald-400" },
];

export default function WebmasterStatsPage() {
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {SUMMARY.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#141414] rounded-xl border border-stone-200 dark:border-white/10 shadow-sm p-4 text-center"
          >
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white dark:bg-[#141414] rounded-[20px] border border-stone-200 dark:border-white/10 shadow-sm p-6">
        <h3 className="font-display text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">
          Commandes cette semaine
        </h3>
        <div className="mt-5 flex items-end gap-2 h-[150px]">
          {WEEK_DATA.map((d, i) => {
            const isHighlight = i === 5; // Saturday
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                <span className="text-[10px] font-semibold text-stone-500 dark:text-gray-400">
                  {d.value}
                </span>
                <div
                  className={`w-full rounded-t-lg animate-fade-up ${
                    isHighlight
                      ? "bg-[#DC2626]"
                      : "bg-stone-200 dark:bg-white/10"
                  }`}
                  style={{
                    height: `${(d.value / MAX) * 110}px`,
                    animationDelay: `${i * 70}ms`,
                  } as React.CSSProperties}
                />
                <span className="text-[9px] text-stone-400 dark:text-gray-500">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
