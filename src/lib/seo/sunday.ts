// Cities that have a « boucheries halal ouvertes le dimanche » page
// (/boucheries-halal-ouvertes-dimanche/[ville]). The page's generateStaticParams, the sitemap and
// the closed route registry (src/lib/seo/routes.ts) all read this one list. Every slug must be
// a city of SEO_CITIES (pinned by src/lib/__tests__/seo/routes.test.ts).

export const SUNDAY_CITY_SLUGS: readonly string[] = [
  "lyon",
  "grenoble",
  "saint-etienne",
  "chambery",
  "annecy",
  "aix-les-bains",
  "villeurbanne",
  "venissieux",
  "vaulx-en-velin",
  "annemasse",
  "voiron",
  "echirolles",
  "bron",
  "saint-priest",
  "bourgoin-jallieu",
];
