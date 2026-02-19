export default function ProfilLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 animate-pulse">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gray-200 dark:bg-white/[0.06] rounded-full" />
          <div>
            <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-36 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
          </div>
        </div>

        {/* Settings sections */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4">
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-32 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-full mb-2" />
              <div className="h-3 bg-gray-50 dark:bg-white/[0.03] rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
