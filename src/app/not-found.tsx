import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <div className="text-7xl font-extrabold text-[#DC2626]/20 mb-2">404</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Page introuvable
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          Cette page n&apos;existe pas ou a ete deplacee.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
          <Link
            href="/decouvrir"
            className="px-6 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
          >
            Retour a l&apos;accueil
          </Link>
          <Link
            href="/commandes"
            className="px-6 py-2.5 bg-white dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-[#ece8e3] dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            Mes commandes
          </Link>
        </div>
      </div>
    </div>
  );
}
