/**
 * Types of the SEO city catalog. The data lives in one file per department
 * (two for Savoie); src/lib/seo/cities.ts assembles it and is the only module
 * the rest of the code imports.
 *
 * Wording rules for every text field (chantier C1-SEO, decision D6): no fee
 * figure, no online payment, no delivery, no pickup-time promise, no halal
 * label guarantee, no superlative or unverifiable number, and nothing
 * about the shops of the city, so that each text stays true with zero shop.
 */

export type SeoCity = {
  slug: string;
  name: string;
  /** Name of the department the city belongs to. */
  region: string;
  /** Meta description and hero text: 140 to 160 characters, unique, names the city. */
  description: string;
  latitude: number;
  longitude: number;
  /** Districts and neighbouring communes shown on the city pages. */
  districts: readonly string[];
  /** Verifiable local facts: geography, access, districts, landmarks, occasions. */
  localContext: string;
  /** Lowercase list of cuts and dishes, rendered after « Spécialités appréciées à … : ». */
  specialty: string;
  /** ISO date of the last real change of this city's text; CITY_CONTENT_UPDATED otherwise. */
  lastUpdated?: string;
};

/** A city as written in a department data file: its region is its department's name. */
export type SeoCityData = Omit<SeoCity, "region">;

export type SeoDepartment = {
  slug: string;
  name: string;
  region: string;
  /** Slugs of the cities of this department, derived from its data file(s). */
  citySlugs: readonly string[];
  /** Meta description and hero text: 140 to 160 characters, names the department. */
  description: string;
  /** Verifiable regional context for the department hub page. */
  context: string;
};

/** A department as written in its data file: its city list comes from the city data. */
export type SeoDepartmentData = Omit<SeoDepartment, "citySlugs">;
