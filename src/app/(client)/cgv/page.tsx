// src/app/(client)/cgv/page.tsx — Conditions Générales de Vente
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente",
  robots: { index: true, follow: true },
};

export default function CGV() {
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
          Conditions Générales de Vente
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (CGV) régissent les relations
              contractuelles entre les utilisateurs de la plateforme Klik&amp;Go
              (ci-après &quot;le Client&quot;) et les boucheries partenaires
              (ci-après &quot;le Boucher&quot;), via la plateforme klikandgo.app.
            </p>
            <p>
              Klik&amp;Go agit en tant qu&apos;intermédiaire technique mettant en relation
              les Clients et les Bouchers. Les ventes sont conclues directement entre
              le Client et le Boucher.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Commandes</h2>
            <p>
              Le Client passe commande via la plateforme en sélectionnant les produits
              souhaités et un créneau de retrait. La commande est transmise au Boucher
              qui peut l&apos;accepter ou la refuser.
            </p>
            <p>
              Une commande acceptée engage le Boucher à préparer les produits commandés
              pour le créneau de retrait sélectionné.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Prix et paiement</h2>
            <p>
              Les prix affichés sont en euros TTC. Pour les produits vendus au poids,
              le prix final peut varier en fonction du poids réel du produit préparé.
              Dans ce cas, un ajustement de prix est proposé au Client avant finalisation.
            </p>
            <p>
              Le paiement s&apos;effectue au moment du retrait en boutique (paiement sur place)
              ou en ligne via la plateforme selon les modalités proposées par le Boucher.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Retrait (Click &amp; Collect)</h2>
            <p>
              Les commandes sont à retirer en boutique dans le créneau horaire sélectionné.
              Un code de retrait est fourni au Client pour sécuriser la remise de la commande.
            </p>
            <p>
              Klik&amp;Go ne propose pas de service de livraison. Toutes les commandes
              fonctionnent en mode Click &amp; Collect (retrait en boutique).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Annulation</h2>
            <p>
              Le Client peut annuler sa commande tant que celle-ci n&apos;a pas été acceptée
              par le Boucher. Une fois la commande en cours de préparation, l&apos;annulation
              n&apos;est plus possible.
            </p>
            <p>
              Le Boucher peut refuser une commande pour des raisons de stock insuffisant
              ou de fermeture exceptionnelle.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Programme de fidélité</h2>
            <p>
              Klik&amp;Go propose un programme de fidélité permettant aux Clients réguliers
              de bénéficier de réductions. Les conditions et paliers sont précisés dans
              la section &quot;Avantages&quot; de la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Codes promotionnels</h2>
            <p>
              Les codes promotionnels sont soumis à des conditions d&apos;utilisation spécifiques
              (durée de validité, montant minimum, produits éligibles). Ils ne sont pas
              cumulables sauf mention contraire.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">8. Responsabilité</h2>
            <p>
              Klik&amp;Go, en tant qu&apos;intermédiaire technique, ne saurait être tenu
              responsable de la qualité des produits vendus par les Bouchers partenaires.
              Toute réclamation relative aux produits doit être adressée directement
              au Boucher concerné.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">9. Droit applicable</h2>
            <p>
              Les présentes CGV sont soumises au droit français. En cas de litige, une
              solution amiable sera recherchée avant toute action judiciaire. À défaut,
              les tribunaux français seront compétents.
            </p>
          </section>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-8">
            Dernière mise à jour : mars 2026
          </p>
        </div>
      </div>
    </div>
  );
}
