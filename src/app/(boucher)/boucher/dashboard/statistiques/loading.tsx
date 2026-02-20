export default function StatistiquesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-36 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4">
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-16 mb-3" />
            <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded w-20" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-6">
        <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-40 mb-4" />
        <div className="h-48 bg-gray-50 dark:bg-white/[0.03] rounded-lg" />
      </div>
    </div>
  );
}
