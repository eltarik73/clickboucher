export default function BoucherSupportLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-28 mb-2" />
          <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-56" />
        </div>
        <div className="h-9 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-36" />
      </div>

      {/* Ticket rows */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-white/[0.03]">
            <div className="w-5 h-5 bg-gray-200 dark:bg-white/[0.06] rounded" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-48 mb-1" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-32" />
            </div>
            <div className="h-5 bg-gray-100 dark:bg-white/[0.04] rounded-full w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
