// src/app/(client)/politique-de-confidentialite/page.tsx — Politique de confidentialité
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité de Klik&Go. Découvrez comment nous protégeons vos données personnelles conformément au RGPD et à la loi Informatique et Libertés.",
  robots: { index: true, follow: true },
};

export default function PolitiqueConfidentialite() {
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
          Politique de confidentialité
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles collectées sur
              klikandgo.app est Klik&amp;Go, joignable à l&apos;adresse{" "}
              <a href="mailto:contact@klikandgo.fr" className="text-[#DC2626]">contact@klikandgo.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Données d&apos;identification</strong> : nom, prénom, adresse email</li>
              <li><strong>Données de commande</strong> : historique des commandes, produits commandés, montants</li>
              <li><strong>Données de connexion</strong> : adresse IP, navigateur, appareil (via Clerk)</li>
              <li><strong>Données de fidélité</strong> : nombre de commandes, récompenses obtenues</li>
              <li><strong>Données professionnelles</strong> (clients PRO) : SIRET, nom d&apos;entreprise, secteur</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Finalités du traitement</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gérer votre compte et authentifier votre identité</li>
              <li>Traiter et suivre vos commandes</li>
              <li>Vous envoyer des notifications relatives à vos commandes</li>
              <li>Gérer le programme de fidélité</li>
              <li>Améliorer nos services et votre expérience utilisateur</li>
              <li>Assurer la sécurité de la plateforme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Base légale</h2>
            <p>
              Le traitement de vos données repose sur l&apos;exécution du contrat
              (traitement des commandes), votre consentement (notifications marketing),
              et notre intérêt légitime (amélioration du service, sécurité).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Sous-traitants</h2>
            <p>Vos données peuvent être transmises aux sous-traitants suivants :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Clerk</strong> (États-Unis) : authentification et gestion des comptes</li>
              <li><strong>Vercel</strong> (États-Unis) : hébergement de la plateforme</li>
              <li><strong>Railway</strong> (États-Unis) : hébergement de la base de données</li>
              <li><strong>Resend</strong> : envoi des emails transactionnels</li>
              <li><strong>Upstash</strong> : limitation de débit (rate limiting)</li>
            </ul>
            <p>
              Ces sous-traitants sont conformes au RGPD et/ou bénéficient de garanties
              appropriées pour le transfert de données hors UE.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Durée de conservation</h2>
            <p>
              Vos données sont conservées pendant la durée de votre inscription sur la
              plateforme, puis pendant une durée de 3 ans à compter de votre dernière
              activité, conformément aux obligations légales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Vos droits</h2>
            <p>
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données</li>
              <li><strong>Droit de rectification</strong> : corriger vos données inexactes</li>
              <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
              <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement de vos données</li>
              <li><strong>Droit à la limitation</strong> : limiter le traitement de vos données</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à{" "}
              <a href="mailto:contact@klikandgo.fr" className="text-[#DC2626]">contact@klikandgo.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">8. Cookies</h2>
            <p>
              Klik&amp;Go utilise uniquement des cookies essentiels au fonctionnement
              du service (authentification, panier, préférences de thème). Aucun cookie
              publicitaire ou de tracking n&apos;est déposé.
            </p>
            <p>
              Si l&apos;outil d&apos;analyse Plausible est activé, il fonctionne sans cookies
              et est conforme au RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">9. Réclamation</h2>
            <p>
              Si vous estimez que le traitement de vos données n&apos;est pas conforme,
              vous pouvez introduire une réclamation auprès de la CNIL :{" "}
              <a href="https://www.cnil.fr" className="text-[#DC2626]" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
            </p>
          </section>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-8">
            Dernière mise à jour : mars 2026
          </p>
        </div>
      </div>
    </div>
  );
}
