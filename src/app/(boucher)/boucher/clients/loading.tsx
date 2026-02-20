export default function BoucherClientsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-32 mb-2" />
          <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
        </div>
        <div className="h-9 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-28" />
      </div>

      {/* Search bar */}
      <div className="h-10 bg-gray-100 dark:bg-white/[0.04] rounded-lg" />

      {/* Client rows */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-3 border-b border-gray-50 dark:border-white/[0.03] flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-white/[0.06] rounded-full shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-32 mb-1" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
            </div>
            <div className="h-6 bg-gray-100 dark:bg-white/[0.04] rounded-full w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
