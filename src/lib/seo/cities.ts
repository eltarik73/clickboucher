import { HAUTE_SAVOIE_CITIES, HAUTE_SAVOIE_DEPARTMENT } from "./cities/haute-savoie";
import { ISERE_CITIES, ISERE_DEPARTMENT } from "./cities/isere";
import { LOIRE_CITIES, LOIRE_DEPARTMENT } from "./cities/loire";
import { RHONE_CITIES, RHONE_DEPARTMENT } from "./cities/rhone";
import { SAVOIE_CHAMBERY_CITIES, SAVOIE_DEPARTMENT } from "./cities/savoie-chambery";
import { SAVOIE_LAC_VALLEES_CITIES } from "./cities/savoie-lac-vallees";
import type { SeoCity, SeoCityData, SeoDepartment, SeoDepartmentData } from "./cities/types";

export type { SeoCity, SeoDepartment } from "./cities/types";

/**
 * Public API of the SEO city catalog (/boucherie-halal/[ville], the department
 * hubs and every page derived from them). The data is written per department;
 * a city exists only inside its department, which gives it its region and puts
 * it in that department's city list, so no city can be left outside a department.
 */

/** ISO date (Europe/Paris) of the last real change of the city texts. */
export const CITY_CONTENT_UPDATED = "2026-11-15";

type DepartmentSource = {
  department: SeoDepartmentData;
  cities: readonly SeoCityData[];
};

// Order matters: SEO_CITIES lists Savoie first, Chambéry first.
const DEPARTMENT_SOURCES: readonly DepartmentSource[] = [
  {
    department: SAVOIE_DEPARTMENT,
    cities: [...SAVOIE_CHAMBERY_CITIES, ...SAVOIE_LAC_VALLEES_CITIES],
  },
  { department: HAUTE_SAVOIE_DEPARTMENT, cities: HAUTE_SAVOIE_CITIES },
  { department: ISERE_DEPARTMENT, cities: ISERE_CITIES },
  { department: RHONE_DEPARTMENT, cities: RHONE_CITIES },
  { department: LOIRE_DEPARTMENT, cities: LOIRE_CITIES },
];

export const SEO_CITIES: readonly SeoCity[] = DEPARTMENT_SOURCES.flatMap(({ department, cities }) =>
  cities.map((city) => ({ ...city, region: department.name }))
);

export const SEO_DEPARTMENTS: readonly SeoDepartment[] = DEPARTMENT_SOURCES.map(
  ({ department, cities }) => ({ ...department, citySlugs: cities.map((city) => city.slug) })
);

export function getDepartmentForCity(citySlug: string): SeoDepartment | undefined {
  return SEO_DEPARTMENTS.find((d) => d.citySlugs.includes(citySlug));
}
