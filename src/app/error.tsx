"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#DC2626]/10 flex items-center justify-center">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Oups, une erreur est survenue
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          Ne vous inquietez pas, vos donnees sont en securite. Essayez de recharger la page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
          >
            Reessayer
          </button>
          <a
            href="/decouvrir"
            className="px-6 py-2.5 bg-white dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-[#ece8e3] dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            Retour a l&apos;accueil
          </a>
        </div>
      </div>
    </div>
  );
}
