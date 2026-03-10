export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Hero skeleton — matches actual white hero */}
      <div className="bg-white dark:bg-[#0A0A0A] pb-10 pt-16 px-5">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full mx-auto mb-4 animate-pulse" />
          <div className="h-8 bg-gray-100 dark:bg-white/10 rounded-lg w-64 mx-auto mb-3 animate-pulse" />
          <div className="h-4 bg-gray-50 dark:bg-white/5 rounded-lg w-40 mx-auto animate-pulse" />
        </div>
      </div>

      {/* Shop cards skeleton */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-20">
        <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-48 mb-2 animate-pulse" />
        <div className="h-3.5 bg-gray-100 dark:bg-white/[0.04] rounded-lg w-32 mb-5 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-[#ece8e3]/60 dark:border-white/[0.06] overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-200 dark:bg-white/[0.06]" />
              <div className="p-3.5">
                <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-36 mb-2" />
                <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-48 mb-2.5" />
                <div className="h-7 bg-gray-100 dark:bg-white/[0.04] rounded-lg w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
