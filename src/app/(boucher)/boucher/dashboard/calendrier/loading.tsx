export default function CalendrierLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-32 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-44" />
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-5">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded" />
          ))}
        </div>
        {/* Day cells */}
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid grid-cols-7 gap-2 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((col) => (
              <div key={col} className="h-10 bg-gray-50 dark:bg-white/[0.03] rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
