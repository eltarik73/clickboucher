export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 animate-pulse">
        <div className="h-7 bg-gray-200 dark:bg-white/[0.06] rounded-lg w-44 mb-6" />

        {/* Order summary */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4 mb-4">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-28 mb-4" />
          {[1, 2].map((i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-50 dark:border-white/[0.03]">
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-36" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-14" />
            </div>
          ))}
        </div>

        {/* Pickup time */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200/60 dark:border-white/[0.06] p-4 mb-4">
          <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded w-36 mb-3" />
          <div className="h-10 bg-gray-100 dark:bg-white/[0.04] rounded-lg" />
        </div>

        {/* CTA */}
        <div className="h-12 bg-gray-200 dark:bg-white/[0.06] rounded-xl" />
      </div>
    </div>
  );
}
