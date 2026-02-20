export default function BoucherParametresLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Title */}
      <div>
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-36 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-white/[0.04] rounded w-52" />
      </div>

      {/* Settings sections */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-5 space-y-4">
          <div className="h-5 bg-gray-200 dark:bg-white/[0.06] rounded w-40" />
          {[1, 2].map((j) => (
            <div key={j}>
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-28 mb-2" />
              <div className="h-10 bg-gray-50 dark:bg-white/[0.03] rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
