export default function DecouvrirLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Hero skeleton */}
      <div className="bg-[#0A0A0A] pb-16 pt-20 px-5">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-20 h-20 bg-white/10 rounded-full mx-auto mb-6 animate-pulse" />
          <div className="h-10 bg-white/10 rounded-lg w-72 mx-auto mb-4 animate-pulse" />
          <div className="h-5 bg-white/5 rounded-lg w-48 mx-auto animate-pulse" />
        </div>
      </div>

      {/* Shop cards skeleton */}
      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="h-8 bg-gray-200 dark:bg-white/10 rounded-lg w-56 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-100 dark:bg-white/5 rounded-lg w-40 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 overflow-hidden">
              <div className="h-48 bg-gray-200 dark:bg-white/10 animate-pulse" />
              <div className="p-4">
                <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-40 mb-2 animate-pulse" />
                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-56 mb-3 animate-pulse" />
                <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg w-28 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
