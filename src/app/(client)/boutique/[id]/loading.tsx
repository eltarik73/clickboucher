export default function BoutiqueLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-5xl">
        {/* Hero skeleton */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden h-[240px] bg-gray-200 dark:bg-white/[0.06] animate-pulse" />

        {/* Info bar skeleton */}
        <div className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-40 mb-1.5 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-56 animate-pulse" />
        </div>

        {/* Category pills skeleton */}
        <div className="px-4 flex gap-2 mb-3 border-b border-gray-200/50 dark:border-white/[0.06] pb-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-[20px] w-16 animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton — auto-fill responsive */}
        <div
          className="px-3 pb-24"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "8px",
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-gray-200 dark:bg-white/[0.06]" />
              <div className="px-2 pt-1.5 pb-2">
                <div className="h-3 w-3/4 bg-gray-200 dark:bg-white/[0.06] rounded mb-[3px]" />
                <div className="flex gap-[3px] mb-1">
                  <div className="h-3 w-6 bg-gray-200 dark:bg-white/[0.06] rounded-[3px]" />
                  <div className="h-3 w-5 bg-gray-200 dark:bg-white/[0.06] rounded-[3px]" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-white/[0.06] rounded" />
                  <div className="w-[26px] h-[26px] bg-gray-200 dark:bg-white/[0.06] rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
