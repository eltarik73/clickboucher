export default function BonsPlansLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-20 animate-pulse">
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-36 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-56 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
              <div className="h-36 bg-gray-200 dark:bg-white/[0.06]" />
              <div className="p-4">
                <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-40 mb-2" />
                <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-full mb-2" />
                <div className="flex justify-between items-center mt-3">
                  <div className="h-5 bg-primary/20 rounded-full w-20" />
                  <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
