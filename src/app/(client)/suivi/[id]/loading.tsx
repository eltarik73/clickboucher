export default function SuiviLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-white/[0.06]" />
          <div className="flex-1">
            <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-44 mb-1.5" />
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-32" />
          </div>
          <div className="h-6 bg-gray-100 dark:bg-white/[0.04] rounded-full w-20" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-5 animate-pulse">
        {/* Tracker skeleton */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
          <div className="flex items-center gap-3 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/[0.06]" />
                <div className="h-2 bg-gray-100 dark:bg-white/[0.04] rounded w-12" />
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-100 dark:bg-white/[0.04] rounded-full" />
        </div>

        {/* Shop info */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-4">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-36 mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-4">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-20 mb-3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between py-2">
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-32" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-14" />
            </div>
          ))}
          <div className="border-t border-[#ece8e3] dark:border-white/10 pt-3 mt-3 flex justify-between">
            <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-12" />
            <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-16" />
          </div>
        </div>
      </main>
    </div>
  );
}
