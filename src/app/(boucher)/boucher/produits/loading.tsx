export default function BoucherProduitsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-pulse">
      {/* Header bar */}
      <div className="h-28 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-white/[0.06] dark:to-white/[0.03] rounded-[14px]" />

      {/* Category pills */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-white/[0.06] rounded-full w-20" />
        ))}
      </div>

      {/* Product cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-3 flex gap-3">
            <div className="w-16 h-16 bg-gray-200 dark:bg-white/[0.06] rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-28 mb-2" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-20 mb-1" />
              <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
