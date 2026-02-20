export default function EspaceBoucherLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Hero skeleton */}
      <section className="bg-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-5 py-20 text-center animate-pulse">
          <div className="h-6 bg-white/10 rounded-full w-48 mx-auto mb-8" />
          <div className="h-10 bg-white/10 rounded-lg w-72 mx-auto mb-3" />
          <div className="h-10 bg-white/10 rounded-lg w-56 mx-auto mb-5" />
          <div className="h-5 bg-white/5 rounded-lg w-80 mx-auto mb-12" />
          <div className="flex items-center justify-center gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <div className="h-8 bg-white/10 rounded w-16 mx-auto mb-1" />
                <div className="h-3 bg-white/5 rounded w-20 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packs skeleton */}
      <div className="max-w-6xl mx-auto px-5 py-20 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-56 mx-auto mb-3" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-64 mx-auto mb-14" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 rounded-2xl p-7">
              <div className="h-5 bg-gray-100 dark:bg-white/[0.04] rounded-full w-24 mb-4" />
              <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded w-28 mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-white/[0.06] rounded w-20 mb-6" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-full" />
                ))}
              </div>
              <div className="h-12 bg-gray-200 dark:bg-white/[0.06] rounded-xl mt-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
