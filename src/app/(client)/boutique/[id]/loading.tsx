export default function BoutiqueLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-5xl">
        {/* Hero skeleton */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden h-[300px] bg-gray-200 dark:bg-white/10 animate-pulse" />

        {/* Info bar skeleton */}
        <div className="px-5 py-4">
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-48 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-64 animate-pulse" />
        </div>

        {/* Category tabs skeleton */}
        <div className="px-5 flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 bg-gray-200 dark:bg-white/10 rounded-full w-24 animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton */}
        <div className="px-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 overflow-hidden">
              <div className="h-32 bg-gray-200 dark:bg-white/10 animate-pulse" />
              <div className="p-3">
                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24 mb-2 animate-pulse" />
                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-16 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
