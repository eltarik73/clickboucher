import Link from "next/link";
import { SEO_CITIES } from "@/lib/seo/cities";

export function SeoFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#0a0a0a]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 text-sm md:grid-cols-5">
        <div>
          <h2 className="mb-3 font-extrabold text-[#1C1512] dark:text-white">
            Boucheries halal par ville
          </h2>
          <ul className="space-y-2">
            {SEO_CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/boucherie-halal/${c.slug}`}
                  className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400 dark:hover:text-[#DC2626]"
                >
                  Boucherie halal {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-[#1C1512] dark:text-white">Pour les bouchers</h2>
          <ul className="space-y-2">
            {SEO_CITIES.map((c) => (
              <li key={`partner-${c.slug}`}>
                <Link
                  href={`/devenir-boucher-partenaire/${c.slug}`}
                  className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400 dark:hover:text-[#DC2626]"
                >
                  Devenir partenaire {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-[#1C1512] dark:text-white">Recettes halal</h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/recettes"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Toutes les recettes
              </Link>
            </li>
            <li>
              <Link
                href="/recettes?tag=agneau"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Recettes agneau
              </Link>
            </li>
            <li>
              <Link
                href="/recettes?tag=boeuf"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Recettes bœuf
              </Link>
            </li>
            <li>
              <Link
                href="/recettes?tag=volaille"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Recettes volaille
              </Link>
            </li>
            <li>
              <Link
                href="/recettes?tag=veau"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Recettes veau
              </Link>
            </li>
            <li>
              <Link
                href="/recettes?tag=ramadan"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Recettes ramadan
              </Link>
            </li>
            <li>
              <Link
                href="/recettes?tag=bbq"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Recettes BBQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-[#1C1512] dark:text-white">Bons plans</h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/bons-plans"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Tous les bons plans
              </Link>
            </li>
            <li>
              <Link
                href="/bons-plans/anti-gaspi"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Anti-gaspi viande
              </Link>
            </li>
            <li>
              <Link
                href="/bons-plans/promos"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Promos halal
              </Link>
            </li>
            <li>
              <Link
                href="/bons-plans/vente-flash"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Vente flash
              </Link>
            </li>
            <li>
              <Link
                href="/bons-plans/packs"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Packs viande
              </Link>
            </li>
            <li>
              <Link
                href="/bons-plans/ramadan"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Spécial ramadan
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-[#1C1512] dark:text-white">Klik&Go</h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Accueil
              </Link>
            </li>
            <li>
              <Link
                href="/avantages"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Pourquoi Klik&Go
              </Link>
            </li>
            <li>
              <Link
                href="/click-and-collect-halal"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Click &amp; Collect halal
              </Link>
            </li>
            <li>
              <Link
                href="/commander-viande-halal"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Commander viande halal
              </Link>
            </li>
            <li>
              <Link
                href="/espace-boucher"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Espace boucher
              </Link>
            </li>
            <li>
              <Link
                href="/inscription-boucher"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Inscrire ma boucherie
              </Link>
            </li>
            <li>
              <Link
                href="/presse"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Espace presse
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Contact
              </Link>
            </li>
            <li>
              <Link
                href="/mentions-legales"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Mentions légales
              </Link>
            </li>
            <li>
              <Link
                href="/politique-de-confidentialite"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                Confidentialité
              </Link>
            </li>
            <li>
              <Link
                href="/cgv"
                className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              >
                CGV
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} Klik&Go — Click & Collect pour boucheries halal de proximité.
        </div>
      </div>
    </footer>
  );
}
