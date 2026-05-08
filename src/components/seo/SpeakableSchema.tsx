/**
 * Speakable schema (Schema.org SpeakableSpecification).
 *
 * Indique aux assistants vocaux (Google Assistant, Alexa via Bing) et aux
 * AI Overviews quels selecteurs CSS d'une page sont les plus adaptes a la
 * lecture audio (TTS). Utile pour la recherche vocale et les "voice answers".
 *
 * Source : Search Engine Land "Schema 2026 visibility AI" — Speakable est
 * recommande sur master pages, FAQ et content informationnel.
 *
 * Usage :
 *   <SpeakableSchema cssSelectors={["h1", ".intro", ".faq-answer"]} />
 *
 * Best practices :
 * - Cibler les sections riches en information factuelle (intro, FAQ, summary)
 * - Eviter les blocs avec liens, boutons, listes longues (mauvais pour TTS)
 * - 1-3 sections max, sinon Google ignore le schema
 */
interface SpeakableSchemaProps {
  cssSelectors?: string[];
  url?: string;
}

export function SpeakableSchema({
  cssSelectors = ["h1", '[data-purpose="ai-summary"]'],
  url,
}: SpeakableSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    ...(url && { url }),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: cssSelectors,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
