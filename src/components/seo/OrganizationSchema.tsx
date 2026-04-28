const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export function OrganizationSchema() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    name: "Klik&Go",
    alternateName: ["Klik and Go", "KlikAndGo"],
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/icons/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: `${SITE_URL}/og-image.png`,
    description:
      "Plateforme de click & collect pour boucheries halal de proximité. Commandez en ligne, récupérez en boutique en moins de 30 minutes.",
    foundingDate: "2025",
    areaServed: [
      { "@type": "City", name: "Chambéry" },
      { "@type": "City", name: "Grenoble" },
      { "@type": "City", name: "Lyon" },
      { "@type": "City", name: "Saint-Étienne" },
      { "@type": "State", name: "Auvergne-Rhône-Alpes" },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "contact@klikandgo.app",
      availableLanguage: ["French"],
    },
    sameAs: [],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: "Klik&Go",
    description: "Click & Collect pour boucheries halal",
    inLanguage: "fr-FR",
    publisher: { "@id": `${SITE_URL}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/recherche?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
