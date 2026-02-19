export default function CommandesLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 animate-pulse">
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-40 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-28" />
                <div className="h-5 bg-gray-100 dark:bg-white/[0.04] rounded-full w-20" />
              </div>
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-48 mb-2" />
              <div className="flex justify-between items-center">
                <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-32" />
                <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
