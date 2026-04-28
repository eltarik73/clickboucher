import Link from "next/link";
import { SEO_CITIES } from "@/lib/seo/cities";

export function SeoFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-3">
            Boucheries halal par ville
          </h3>
          <ul className="space-y-2">
            {SEO_CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/boucherie-halal/${c.slug}`}
                  className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] dark:hover:text-[#DC2626] transition-colors"
                >
                  Boucherie halal {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-3">
            Recettes halal
          </h3>
          <ul className="space-y-2">
            <li><Link href="/recettes" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Toutes les recettes</Link></li>
            <li><Link href="/recettes?tag=agneau" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Recettes agneau</Link></li>
            <li><Link href="/recettes?tag=boeuf" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Recettes bœuf</Link></li>
            <li><Link href="/recettes?tag=volaille" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Recettes volaille</Link></li>
            <li><Link href="/recettes?tag=veau" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Recettes veau</Link></li>
            <li><Link href="/recettes?tag=ramadan" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Recettes ramadan</Link></li>
            <li><Link href="/recettes?tag=bbq" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Recettes BBQ</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-3">
            Bons plans
          </h3>
          <ul className="space-y-2">
            <li><Link href="/bons-plans" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Tous les bons plans</Link></li>
            <li><Link href="/bons-plans/anti-gaspi" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Anti-gaspi viande</Link></li>
            <li><Link href="/bons-plans/promos" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Promos halal</Link></li>
            <li><Link href="/bons-plans/vente-flash" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Vente flash</Link></li>
            <li><Link href="/bons-plans/packs" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Packs viande</Link></li>
            <li><Link href="/bons-plans/ramadan" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Spécial ramadan</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-3">
            Klik&Go
          </h3>
          <ul className="space-y-2">
            <li><Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Accueil</Link></li>
            <li><Link href="/avantages" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Pourquoi Klik&Go</Link></li>
            <li><Link href="/espace-boucher" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Espace boucher</Link></li>
            <li><Link href="/inscription-boucher" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Inscrire ma boucherie</Link></li>
            <li><Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Contact</Link></li>
            <li><Link href="/mentions-legales" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Mentions légales</Link></li>
            <li><Link href="/politique-de-confidentialite" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">Confidentialité</Link></li>
            <li><Link href="/cgv" className="text-gray-600 dark:text-gray-400 hover:text-[#DC2626] transition-colors">CGV</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 py-5 text-xs text-gray-500 dark:text-gray-400 text-center">
          © {new Date().getFullYear()} Klik&Go — Click & Collect pour boucheries halal de proximité.
        </div>
      </div>
    </footer>
  );
}
