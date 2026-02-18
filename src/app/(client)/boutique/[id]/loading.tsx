export default function BoutiqueLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-5xl">
        {/* Hero skeleton */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden h-[260px] bg-gray-200 dark:bg-white/[0.06] animate-pulse" />

        {/* Info bar skeleton */}
        <div className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-40 mb-1.5 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-56 animate-pulse" />
        </div>

        {/* Category pills skeleton */}
        <div className="px-3 flex gap-1.5 mb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-full w-16 animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton — 3 cols, compact */}
        <div className="grid grid-cols-3 gap-2 px-3 pb-24">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="bg-white dark:bg-white/[0.03] rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-white/[0.06]" />
              <div className="px-1.5 pt-1.5 pb-2">
                <div className="h-3 w-3/4 bg-gray-200 dark:bg-white/[0.06] rounded" />
                <div className="h-3.5 w-1/2 bg-gray-200 dark:bg-white/[0.06] rounded mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
