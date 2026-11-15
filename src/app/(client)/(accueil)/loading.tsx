export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Hero skeleton — matches actual white hero */}
      <div className="bg-white px-5 pb-10 pt-16 dark:bg-[#0A0A0A]">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-white/10" />
          <div className="mx-auto mb-3 h-8 w-64 animate-pulse rounded-lg bg-gray-100 dark:bg-white/10" />
          <div className="mx-auto h-4 w-40 animate-pulse rounded-lg bg-gray-50 dark:bg-white/5" />
        </div>
      </div>

      {/* Shop cards skeleton */}
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        <div className="mb-2 h-6 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-white/[0.06]" />
        <div className="mb-5 h-3.5 w-32 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.04]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-2xl border border-[#ece8e3]/60 bg-white dark:border-white/[0.06] dark:bg-gray-800"
            >
              <div className="h-40 bg-gray-200 dark:bg-white/[0.06]" />
              <div className="p-3.5">
                <div className="mb-2 h-4 w-36 rounded bg-gray-200 dark:bg-white/[0.06]" />
                <div className="mb-2.5 h-3 w-48 rounded bg-gray-100 dark:bg-white/[0.04]" />
                <div className="h-7 w-24 rounded-lg bg-gray-100 dark:bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
