const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Klik&Go",
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    description:
      "Plateforme de click & collect pour boucheries halal. Commandez en ligne, récupérez en boutique.",
    foundingDate: "2025",
    areaServed: {
      "@type": "State",
      name: "Auvergne-Rhône-Alpes",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "contact@klikandgo.app",
      availableLanguage: ["French"],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
