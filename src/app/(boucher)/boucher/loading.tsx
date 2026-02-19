export default function BoucherLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Title */}
      <div>
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-44 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-56" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4">
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-16 mb-3" />
            <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded w-12 mb-1" />
            <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-24" />
          </div>
        ))}
      </div>

      {/* Content cards */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 dark:bg-white/[0.06] rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-40 mb-2" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-56" />
            </div>
            <div className="h-6 bg-gray-100 dark:bg-white/[0.04] rounded-full w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
