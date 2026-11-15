import NextLink from "next/link";
import type { ComponentProps } from "react";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { departmentLocative } from "@/lib/seo/titles";

// Ce footer (≈ 130 liens) est rendu sur chaque page client. Avec le prefetch par
// défaut de next/link, chaque vue déclenchait autant de requêtes RSC dès que le
// footer entrait dans le viewport. Les ancres et href restent identiques (SEO).
function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}

type FooterLink = { href: string; label: string };
type FooterColumn = { title: string; links: readonly FooterLink[] };

// The footer is part of the client bundle of every page: the URL shapes are written here rather
// than imported from src/lib/seo/routes.ts, which loads the district, product and occasion data.
const COLUMNS: readonly FooterColumn[] = [
  {
    title: "Boucheries halal par région",
    links: [
      { href: "/trouver-boucherie-halal", label: "Trouver une boucherie halal" },
      { href: "/boucheries-halal-rhone-alpes", label: "Boucheries halal en Auvergne-Rhône-Alpes" },
      ...SEO_DEPARTMENTS.map((dept) => ({
        href: `/boucheries-halal/${dept.slug}`,
        label: `Boucheries halal ${departmentLocative(dept)}`,
      })),
    ],
  },
  {
    title: "Boucheries halal par ville",
    links: SEO_CITIES.map((c) => ({
      href: `/boucherie-halal/${c.slug}`,
      label: `Boucherie halal ${c.name}`,
    })),
  },
  {
    title: "Pour les bouchers",
    links: SEO_CITIES.map((c) => ({
      href: `/devenir-boucher-partenaire/${c.slug}`,
      label: `Devenir partenaire ${c.name}`,
    })),
  },
  {
    title: "Recettes halal",
    links: [
      { href: "/recettes", label: "Toutes les recettes" },
      { href: "/recettes?tag=agneau", label: "Recettes agneau" },
      { href: "/recettes?tag=boeuf", label: "Recettes bœuf" },
      { href: "/recettes?tag=volaille", label: "Recettes volaille" },
      { href: "/recettes?tag=veau", label: "Recettes veau" },
      { href: "/recettes?tag=ramadan", label: "Recettes ramadan" },
      { href: "/recettes?tag=bbq", label: "Recettes BBQ" },
    ],
  },
  {
    title: "Bons plans",
    links: [
      { href: "/bons-plans", label: "Tous les bons plans" },
      { href: "/bons-plans/anti-gaspi", label: "Anti-gaspi viande" },
      { href: "/bons-plans/promos", label: "Promos halal" },
      { href: "/bons-plans/vente-flash", label: "Vente flash" },
      { href: "/bons-plans/packs", label: "Packs viande" },
      { href: "/bons-plans/ramadan", label: "Spécial ramadan" },
    ],
  },
  {
    title: "Klik&Go",
    links: [
      { href: "/", label: "Accueil" },
      { href: "/avantages", label: "Pourquoi Klik&Go" },
      { href: "/click-and-collect-halal", label: "Click & Collect halal" },
      { href: "/commander-viande-halal", label: "Commander viande halal" },
      { href: "/espace-boucher", label: "Espace boucher" },
      { href: "/inscription-boucher", label: "Inscrire ma boucherie" },
      { href: "/presse", label: "Espace presse" },
      { href: "/contact", label: "Contact" },
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/politique-de-confidentialite", label: "Confidentialité" },
      { href: "/cgv", label: "CGV" },
    ],
  },
];

export function SeoFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#0a0a0a]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 text-sm md:grid-cols-3 lg:grid-cols-6">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="mb-3 font-extrabold text-[#1C1512] dark:text-white">{column.title}</h2>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-600 transition-colors hover:text-[#DC2626] dark:text-gray-400 dark:hover:text-[#DC2626]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-white/[0.06]">
        <div
          className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-gray-600 dark:text-gray-400"
          suppressHydrationWarning
        >
          © {new Date().getFullYear()} Klik&Go — Click & Collect pour boucheries halal de proximité.
        </div>
      </div>
    </footer>
  );
}
