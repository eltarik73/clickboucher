/**
 * SEO districts config — quartiers prioritaires pour les pages SEO.
 * Sprint 7 (mai 2026) — pivot annuaire local.
 *
 * Cible : "boucherie halal [quartier]" (M-Fort volume, AUCUN concurrent halal).
 */

export type SeoDistrict = {
  slug: string;
  name: string;
  /** Slug de la ville parente (depuis SEO_CITIES) */
  citySlug: string;
  cityName: string;
  /** Code postal du quartier (si distinct) */
  zipCode?: string;
  /** Description SEO courte pour metadata */
  description: string;
  /** Contexte unique du quartier (≥150 mots, anti-thin-content) */
  context: string;
  /** Stations métro/tram/bus proches pour le maillage local */
  transports?: readonly string[];
};

export const SEO_DISTRICTS: readonly SeoDistrict[] = [
  // ── LYON ──
  {
    slug: "la-guillotiere",
    name: "La Guillotière",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69007",
    description:
      "Boucheries halal à La Guillotière (Lyon 7e). Click & collect halal dans le quartier emblématique de la communauté musulmane lyonnaise.",
    context:
      "La Guillotière, quartier multi-culturel par excellence du 7e arrondissement de Lyon, est historiquement le cœur battant des boucheries halal lyonnaises. Cours Gambetta, avenue Berthelot, place du Pont, rue Sébastien Gryphe : c'est ici que vous trouvez la plus grande concentration de boucheries halal certifiées de tout Lyon. Le quartier accueille la mosquée Othmane de Lyon, plusieurs commerces halal historiques, et de nombreuses familles maghrébines, turques, comoriennes installées de longue date. Sur Klik&Go, les boucheries halal de La Guillotière proposent une viande halal certifiée fraîche du jour, click & collect possible. Pratique pour les familles qui travaillent en centre Lyon et veulent commander pendant la pause déjeuner.",
    transports: ["Métro D Guillotière", "Métro D Saxe-Gambetta", "Tram T1 Quai Claude Bernard"],
  },
  {
    slug: "vaise",
    name: "Vaise",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69009",
    description:
      "Boucheries halal à Vaise (Lyon 9e). Click & collect halal dans le nord-ouest lyonnais, quartier dynamique en pleine mutation.",
    context:
      "Vaise, quartier du 9e arrondissement de Lyon en pleine mutation économique (pôle Vaise Industries, sièges sociaux), accueille une communauté musulmane en croissance. Plusieurs boucheries halal sont implantées rue Marietton, rue Tissot, et autour du quartier de la Gare de Vaise. Les bouchers halal de Vaise sélectionnent leurs viandes auprès d'éleveurs du Beaujolais et du Bugey. Avec Klik&Go, commandez votre viande halal à Vaise depuis le bureau ou en sortant du métro D, et récupérez votre commande sans attendre.",
    transports: ["Métro D Gare de Vaise", "Métro D Valmy", "Bus C6/C13/C14"],
  },
  {
    slug: "croix-rousse",
    name: "Croix-Rousse",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69004",
    description:
      "Boucheries halal à la Croix-Rousse (Lyon 4e). Click & collect halal sur les pentes et le plateau, quartier des canuts.",
    context:
      "La Croix-Rousse, quartier emblématique du 4e arrondissement de Lyon (« la colline qui travaille »), accueille plusieurs boucheries halal sur le plateau (boulevard de la Croix-Rousse, place de la Croix-Rousse) et sur les pentes (rue Burdeau, rue de l'Annonciade). Le quartier mélange habitants historiques (les canuts), familles musulmanes installées de longue date, et nouveaux arrivants attirés par la qualité de vie. Klik&Go référence les boucheries halal certifiées du 4e arrondissement pour vous permettre de commander en ligne et de récupérer en boutique au créneau choisi.",
    transports: ["Métro C Croix-Rousse", "Métro C Hénon", "Bus 13/18/38/45"],
  },
  {
    slug: "gerland",
    name: "Gerland",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69007",
    description:
      "Boucheries halal à Gerland (Lyon 7e). Click & collect halal dans le sud lyonnais, quartier en plein renouveau.",
    context:
      "Gerland, quartier sud du 7e arrondissement de Lyon, est en pleine transformation urbaine (Biodistrict, Halle Tony Garnier, ENS, Stade Gerland). La communauté musulmane y est implantée depuis les années 70-80 et plusieurs boucheries halal certifiées y sont actives. Sur Klik&Go, les boucheries halal de Gerland proposent une viande halal fraîche, click & collect possible. Pratique pour les habitants de Gerland, du Tonkin sud et des étudiants de l'ENS Lyon.",
    transports: ["Métro B Stade de Gerland", "Métro B Debourg", "Tram T1 Halle Tony Garnier"],
  },
  // ── VENISSIEUX ──
  {
    slug: "les-minguettes",
    name: "Les Minguettes",
    citySlug: "venissieux",
    cityName: "Vénissieux",
    description:
      "Boucheries halal aux Minguettes (Vénissieux). Click & collect halal dans le quartier historique de la communauté musulmane lyonnaise.",
    context:
      "Le quartier des Minguettes à Vénissieux est l'un des hauts lieux de la communauté musulmane du Grand Lyon. Implanté depuis les années 60, le quartier abrite plusieurs boucheries halal historiques de Vénissieux, héritières d'une tradition d'artisanat boucher transmise de génération en génération. Klik&Go référence les boucheries halal certifiées des Minguettes pour vous permettre de commander en ligne et de récupérer en boutique. Pratique pour les familles vénissianes et de tout le sud-est lyonnais.",
    transports: ["Tram T4 Minguettes", "Bus C12/C25"],
  },
  // ── VILLEURBANNE ──
  {
    slug: "gratte-ciel",
    name: "Gratte-Ciel",
    citySlug: "villeurbanne",
    cityName: "Villeurbanne",
    zipCode: "69100",
    description:
      "Boucheries halal aux Gratte-Ciel (Villeurbanne). Click & collect halal au cœur du centre-ville villeurbannais.",
    context:
      "Les Gratte-Ciel, quartier emblématique du centre-ville de Villeurbanne avec ses immeubles Art déco des années 1930, accueille plusieurs boucheries halal de proximité. Cours Émile Zola, avenue Henri Barbusse, rue Francis de Pressensé : le quartier concentre la vie commerçante villeurbannaise. La communauté musulmane des Gratte-Ciel, implantée depuis plusieurs décennies, fréquente régulièrement ces boucheries halal certifiées. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la en sortant du métro Gratte-Ciel.",
    transports: ["Métro A Gratte-Ciel", "Métro A Cusset", "Bus C3/C11"],
  },
  {
    slug: "tonkin",
    name: "Tonkin",
    citySlug: "villeurbanne",
    cityName: "Villeurbanne",
    zipCode: "69100",
    description:
      "Boucheries halal au Tonkin (Villeurbanne). Click & collect halal dans le quartier étudiant et résidentiel.",
    context:
      "Le Tonkin à Villeurbanne, quartier résidentiel et étudiant à proximité du campus Lyon Tech La Doua (INSA, Université Lyon 1), accueille une communauté musulmane mêlant familles installées et étudiants. Plusieurs boucheries halal certifiées y sont implantées et proposent des viandes halal sélectionnées auprès d'éleveurs du Beaujolais et des Dombes. Klik&Go vous fait gagner du temps : commandez en ligne pendant les pauses et récupérez en sortant des cours ou du travail.",
    transports: ["Tram T1 Université Lyon 1", "Tram T4 Croix-Luizet", "Bus C2"],
  },
  // ── GRENOBLE ──
  {
    slug: "villeneuve",
    name: "Villeneuve",
    citySlug: "grenoble",
    cityName: "Grenoble",
    zipCode: "38100",
    description:
      "Boucheries halal à la Villeneuve (Grenoble). Click & collect halal dans le grand quartier sud de Grenoble.",
    context:
      "Le quartier de la Villeneuve, l'un des plus grands quartiers de Grenoble (sud de la ville, à cheval avec Échirolles), accueille une communauté musulmane historique implantée depuis les années 70. Plusieurs boucheries halal certifiées y sont actives, notamment galerie de l'Arlequin et autour de la place des Géants. Les bouchers halal de la Villeneuve sélectionnent leurs viandes auprès d'éleveurs alpins et grenoblois. Klik&Go référence ces boucheries halal pour vous permettre de commander en ligne et de récupérer sans file d'attente.",
    transports: ["Tram A La Bruyère", "Tram A Arlequin", "Bus C5/C7"],
  },
  {
    slug: "mistral",
    name: "Mistral",
    citySlug: "grenoble",
    cityName: "Grenoble",
    zipCode: "38100",
    description:
      "Boucheries halal à Mistral (Grenoble). Click & collect halal dans le quartier ouest grenoblois.",
    context:
      "Le quartier Mistral à Grenoble, situé dans l'ouest de la ville à proximité de la Polygone scientifique, accueille une communauté musulmane installée et plusieurs boucheries halal de proximité. La place de la Commune, le boulevard Joseph Vallier et les rues alentours concentrent les commerces halal du quartier. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la sans attente au créneau choisi.",
    transports: ["Tram A Vallier-Catane", "Tram A Mistral-Drac", "Bus 16/26"],
  },
  // ── SAINT-ETIENNE ──
  {
    slug: "tarentaize",
    name: "Tarentaize",
    citySlug: "saint-etienne",
    cityName: "Saint-Étienne",
    zipCode: "42000",
    description:
      "Boucheries halal à Tarentaize (Saint-Étienne). Click & collect halal dans le quartier nord-ouest stéphanois.",
    context:
      "Le quartier de Tarentaize à Saint-Étienne, situé au nord-ouest de la ville, accueille une communauté musulmane historique des vagues d'immigration ouvrière du XXe siècle. Plusieurs boucheries halal certifiées sont implantées dans le quartier, héritières d'une tradition d'artisanat boucher. Les bouchers halal de Tarentaize sélectionnent leurs viandes auprès d'éleveurs du Forez et du Pilat. Klik&Go vous permet de commander en ligne et de récupérer votre viande sans attente.",
    transports: ["Tram T1 Tarentaize", "Bus M3"],
  },
  {
    slug: "bellevue",
    name: "Bellevue",
    citySlug: "saint-etienne",
    cityName: "Saint-Étienne",
    zipCode: "42100",
    description:
      "Boucheries halal à Bellevue (Saint-Étienne). Click & collect halal dans le quartier sud-est stéphanois.",
    context:
      "Le quartier Bellevue à Saint-Étienne, situé au sud-est de la ville, accueille plusieurs boucheries halal de proximité qui servent les familles bellevuoises et les communes voisines (Saint-Étienne sud, Le Bessat). Les bouchers halal de Bellevue proposent une viande halal certifiée issue d'élevages du Forez et du Pilat. Avec Klik&Go, commandez en ligne et récupérez en quelques minutes au créneau choisi.",
    transports: ["Tram T1 Bellevue", "Bus M3"],
  },
  // ── CHAMBERY ──
  {
    slug: "chambery-le-haut",
    name: "Chambéry-le-Haut",
    citySlug: "chambery",
    cityName: "Chambéry",
    zipCode: "73000",
    description:
      "Boucheries halal à Chambéry-le-Haut. Click & collect halal dans le grand quartier nord de Chambéry.",
    context:
      "Chambéry-le-Haut, le plus grand quartier de Chambéry (nord de la ville), accueille une communauté musulmane installée depuis plusieurs décennies. Plusieurs boucheries halal certifiées y sont actives, notamment autour de la place Maurice Mollard et du boulevard du Théâtre. Les bouchers halal de Chambéry-le-Haut sélectionnent leurs viandes auprès d'éleveurs des Bauges, de la Chartreuse et du bassin chambérien. Klik&Go référence ces boucheries halal pour vous permettre de commander en ligne sans perdre de temps.",
    transports: ["Bus 1/2/3/A"],
  },
];

/** Helper : retourne les quartiers d'une ville donnée */
export function getDistrictsByCity(citySlug: string): readonly SeoDistrict[] {
  return SEO_DISTRICTS.filter((d) => d.citySlug === citySlug);
}

/** Helper : retourne tous les couples ville×quartier pour SSG */
export function getCityDistrictCombinations(): Array<{ ville: string; quartier: string }> {
  return SEO_DISTRICTS.map((d) => ({ ville: d.citySlug, quartier: d.slug }));
}
