export default function CommandeDetailLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-white/[0.06]" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-40 mb-1.5" />
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-28" />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 mt-6 animate-pulse">
        {/* Status card */}
        <div className="p-6 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-white/[0.06]" />
          </div>
          <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-48 mx-auto mb-3" />
          <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-56 mx-auto mb-2" />
          <div className="h-4 bg-gray-50 dark:bg-white/[0.03] rounded w-40 mx-auto" />
        </div>

        {/* Order recap */}
        <div className="mt-6 p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-28 mb-3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between py-1.5">
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-36" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-14" />
            </div>
          ))}
          <div className="border-t border-[#ece8e3] dark:border-white/10 pt-2 mt-2 flex justify-between">
            <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-12" />
            <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-16" />
          </div>
        </div>
      </main>
    </div>
  );
}
