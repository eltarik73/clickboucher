export default function InscriptionProLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-white/[0.06]" />
          <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-36" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 mt-6 space-y-5 animate-pulse">
        {/* Intro card */}
        <div className="bg-[#DC2626]/5 rounded-2xl p-5 border border-[#DC2626]/10">
          <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-56 mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-full mb-1" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-3/4" />
        </div>

        {/* Form skeleton */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5 space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-32 mb-2" />
              <div className="h-12 bg-gray-50 dark:bg-white/[0.03] rounded-xl" />
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div className="h-12 bg-gray-200 dark:bg-white/[0.06] rounded-xl" />
      </main>
    </div>
  );
}
