export default function AbonnementLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-36 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-52" />
      </div>

      {/* Current plan card */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-6">
        <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-32 mb-3" />
        <div className="h-8 bg-gray-200 dark:bg-white/[0.06] rounded w-24 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
      </div>

      {/* Plan options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-5">
            <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-24 mb-2" />
            <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded w-20 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
