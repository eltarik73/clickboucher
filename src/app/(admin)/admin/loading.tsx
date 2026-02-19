export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-48 mb-2" />
          <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-64" />
        </div>
        <div className="h-9 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-28" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4">
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-20 mb-3" />
            <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded w-16" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-20" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-4 py-3 border-b border-gray-50 dark:border-white/[0.03] flex gap-4">
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-24" />
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-32" />
            <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-20" />
            <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-16" />
            <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
