// src/app/(client)/mentions-legales/page.tsx — Mentions légales
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de Klik&Go. Informations sur l'éditeur, l'hébergeur et les conditions d'utilisation du service de click & collect pour boucheries halal.",
  robots: { index: true, follow: true },
};

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-16">
      <div className="max-w-3xl mx-auto px-5 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeft size={16} /> Retour
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-display mb-8">
          Mentions légales
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Éditeur du site</h2>
            <p>
              Le site <strong>klikandgo.app</strong> est édité par :<br />
              Klik&amp;Go — Tarik El Ouardi (Entrepreneur individuel)<br />
              SIRET : en cours d&apos;immatriculation<br />
              Adresse : Chambéry, 73000, France<br />
              Email : <a href="mailto:contact@klikandgo.app" className="text-[#DC2626]">contact@klikandgo.app</a><br />
              Directeur de la publication : Tarik El Ouardi
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Hébergement</h2>
            <p>
              Le site est hébergé par :<br />
              <strong>Vercel Inc.</strong><br />
              440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
              Site web : <a href="https://vercel.com" className="text-[#DC2626]" target="_blank" rel="noopener noreferrer">vercel.com</a>
            </p>
            <p>
              Base de données hébergée par :<br />
              <strong>Railway Corp.</strong><br />
              Site web : <a href="https://railway.app" className="text-[#DC2626]" target="_blank" rel="noopener noreferrer">railway.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu du site (textes, images, logos, icônes, éléments graphiques)
              est protégé par le droit de la propriété intellectuelle. Toute reproduction,
              représentation ou diffusion, en tout ou partie, du contenu de ce site sans
              autorisation préalable est interdite.
            </p>
            <p>
              La marque Klik&amp;Go, le logo et les éléments visuels associés sont la propriété
              exclusive de l&apos;éditeur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Données personnelles</h2>
            <p>
              Les données collectées sur ce site sont traitées conformément au Règlement Général
              sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
              Pour en savoir plus, consultez notre{" "}
              <Link href="/politique-de-confidentialite" className="text-[#DC2626]">
                politique de confidentialité
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Cookies</h2>
            <p>
              Le site utilise des cookies nécessaires au bon fonctionnement (authentification,
              panier, préférences). Aucun cookie publicitaire ou de tracking n&apos;est utilisé.
              L&apos;outil d&apos;analyse Plausible, s&apos;il est activé, est conforme au RGPD et ne
              dépose aucun cookie.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Responsabilité</h2>
            <p>
              L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées
              sur le site, mais ne saurait être tenu responsable des erreurs, d&apos;une absence
              de disponibilité des informations ou de la présence de virus sur le site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Droit applicable</h2>
            <p>
              Les présentes mentions légales sont soumises au droit français. En cas de litige,
              les tribunaux français seront seuls compétents.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
