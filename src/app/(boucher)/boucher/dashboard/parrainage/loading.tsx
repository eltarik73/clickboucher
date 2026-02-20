export default function ParrainageLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-32 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-56" />
      </div>

      {/* Referral code card */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-6">
        <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-36 mb-3" />
        <div className="h-12 bg-gray-100 dark:bg-white/[0.04] rounded-lg mb-3" />
        <div className="h-10 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-32" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4">
            <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-24 mb-3" />
            <div className="h-6 bg-gray-200 dark:bg-white/[0.06] rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
