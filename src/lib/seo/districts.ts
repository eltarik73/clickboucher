/**
 * Editorial data of the district pages (/boucherie-halal/[ville]/[quartier]).
 *
 * Every text here is rendered whatever the shops of the district, so it must
 * stay true with zero shop: it presents the district (history, landmarks,
 * access) and how click & collect works, never that Klik&Go lists shops there,
 * where butchers stand or what they sell, and never a fee, a payment mode, a
 * delivery or a halal-compliance claim (wording rules D6 of chantier C1-SEO, pinned by
 * src/lib/__tests__/seo/seo-data.test.ts). The shops actually listed are shown
 * by the page from the database. Descriptions are 140 to 160 characters.
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
      "Boucherie halal à La Guillotière (Lyon 7e) : le quartier en bref, son accès par le métro D et comment commander votre viande halal en click & collect.",
    context:
      "La Guillotière s'étend sur la rive gauche du Rhône, face à la Presqu'île, dans le 7e arrondissement de Lyon. Ancienne commune rattachée à Lyon en 1852, c'est depuis longtemps un quartier d'arrivée et de brassage : les immigrations italienne, maghrébine, africaine et asiatique y ont laissé leurs commerces et leurs saveurs. Autour de la place Gabriel-Péri, que les Lyonnais appellent la « place du Pont », de la Grande rue de la Guillotière et du cours Gambetta, épiceries orientales, boulangeries, restaurants et commerces de bouche se succèdent. Le quartier se rejoint facilement par le métro D, aux stations Guillotière et Saxe-Gambetta, ou à pied par le pont de la Guillotière depuis la Presqu'île. Pour celles et ceux qui y habitent ou y travaillent, le click & collect permet de préparer ses achats de viande halal à l'avance : vous passez commande en ligne, puis vous la récupérez en boutique au créneau choisi.",
    transports: ["Métro D Guillotière", "Métro D Saxe-Gambetta", "Tram T1 Quai Claude Bernard"],
  },
  {
    slug: "vaise",
    name: "Vaise",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69009",
    description:
      "Boucherie halal à Vaise (Lyon 9e) : le quartier autour de la gare de Vaise, son accès par le métro D et la commande de viande halal en click & collect.",
    context:
      "Vaise s'étend sur la rive droite de la Saône, au nord-ouest de Lyon, dans le 9e arrondissement. Ancienne commune rattachée à Lyon en 1852, longtemps faubourg industriel et ouvrier, le quartier s'est profondément transformé depuis les années 1990 : bureaux, logements neufs et commerces ont pris la place d'une partie des anciens ateliers. La gare de Vaise, terminus de la ligne D du métro, est aussi un pôle d'échanges pour les bus de l'ouest lyonnais ; les stations Valmy et Gorge de Loup desservent le reste du quartier. Autour de la place Valmy, de la Grande rue de Vaise et de la rue Marietton, Vaise garde la vie commerçante d'un quartier de proximité. Si vous travaillez à Vaise ou y passez chaque jour en métro, la commande en click & collect permet de choisir votre viande halal à l'avance et de la retirer en boutique au créneau qui vous convient.",
    transports: ["Métro D Gare de Vaise", "Métro D Valmy", "Bus C6/C13/C14"],
  },
  {
    slug: "croix-rousse",
    name: "Croix-Rousse",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69004",
    description:
      "Boucherie halal à la Croix-Rousse (Lyon 4e) : plateau, pentes et métro C, et comment commander votre viande halal en ligne pour la retirer en boutique.",
    context:
      "La Croix-Rousse, « la colline qui travaille » par opposition à Fourvière, « la colline qui prie », doit son surnom aux canuts, les ouvriers de la soie, dont les révoltes de 1831 et 1834 ont marqué l'histoire sociale de Lyon. Ancienne commune rattachée à Lyon en 1852, elle se partage entre le plateau, qui forme le 4e arrondissement, et les pentes, qui appartiennent au 1er. Sur le plateau, le boulevard de la Croix-Rousse accueille un marché alimentaire, et la Grande rue de la Croix-Rousse prolonge la vie commerçante du quartier. Le métro C, une ligne à crémaillère, relie l'Hôtel de Ville aux stations Croix-Rousse et Hénon. Habitants de longue date, familles et nouveaux arrivants y partagent un quartier aux allures de village, au cœur de la ville. Pour gagner du temps, commandez votre viande halal en ligne et passez la retirer en boutique au créneau choisi.",
    transports: ["Métro C Croix-Rousse", "Métro C Hénon", "Bus 13/18/38/45"],
  },
  {
    slug: "gerland",
    name: "Gerland",
    citySlug: "lyon",
    cityName: "Lyon",
    zipCode: "69007",
    description:
      "Boucherie halal à Gerland (Lyon 7e) : du stade à la halle Tony Garnier, le quartier en bref et la commande de viande halal en click & collect sur Klik&Go.",
    context:
      "Gerland occupe le sud du 7e arrondissement de Lyon, le long du Rhône. Le quartier a un lien direct avec la boucherie : la halle Tony Garnier, aujourd'hui salle de spectacles, est l'ancienne grande halle du marché aux bestiaux des abattoirs de la Mouche, construite au début du XXe siècle sur les plans de l'architecte Tony Garnier. Longtemps industriel, Gerland s'est transformé en quelques décennies : le stade de Gerland, l'École normale supérieure de Lyon, le parc de Gerland, des laboratoires et des logements neufs ont redessiné le quartier. Le métro B, aux stations Stade de Gerland et Debourg, et le tramway T1, aux arrêts Halle Tony Garnier et ENS Lyon, le relient au reste de la ville. Entre deux journées de travail ou d'études, la commande en click & collect permet de préparer ses achats de viande halal en ligne et de les retirer en boutique au créneau choisi.",
    transports: ["Métro B Stade de Gerland", "Métro B Debourg", "Tram T1 Halle Tony Garnier"],
  },
  // ── VENISSIEUX ──
  {
    slug: "les-minguettes",
    name: "Les Minguettes",
    citySlug: "venissieux",
    cityName: "Vénissieux",
    description:
      "Boucherie halal aux Minguettes (Vénissieux) : l'histoire du quartier, son accès en tramway T4 et comment commander votre viande halal en click & collect.",
    context:
      "Les Minguettes forment un grand ensemble construit à partir de la fin des années 1960 sur le plateau qui domine Vénissieux, au sud-est de Lyon. Le quartier a accueilli des familles venues de toute la France et de nombreux pays, et occupe une place à part dans l'histoire récente : c'est de jeunes des Minguettes qu'est venue l'initiative de la Marche pour l'égalité et contre le racisme de 1983. Depuis plusieurs décennies, la rénovation urbaine a remplacé une partie des tours par des immeubles plus bas, de nouveaux équipements et des espaces publics réaménagés. Le tramway T4 relie le quartier au centre de Vénissieux et à Lyon, et des lignes de bus complètent la desserte. Pour les achats en quantité, pour la semaine ou pour les fêtes, la commande en ligne permet de tout préparer à l'avance et de récupérer votre viande halal en boutique au créneau choisi.",
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
      "Boucherie halal aux Gratte-Ciel (Villeurbanne) : le centre-ville des années 1930, le métro A et la commande de viande halal en click & collect sur Klik&Go.",
    context:
      "Les Gratte-Ciel forment le centre-ville de Villeurbanne. Construit au début des années 1930 à l'initiative du maire Lazare Goujon, sur les plans de l'architecte Môrice Leroux, l'ensemble réunit l'hôtel de ville, le Palais du Travail, qui abrite le Théâtre national populaire, et les deux tours qui encadrent l'avenue Henri-Barbusse. Ce quartier, pensé à l'époque comme une vitrine du logement moderne, reste le cœur commerçant de la ville, avec ses commerces de proximité le long de l'avenue Henri-Barbusse et du cours Émile-Zola. Le métro A, aux stations Gratte-Ciel, Flachet et Cusset, le relie à Charpennes et à la Presqu'île de Lyon. En sortant du métro ou du travail, vous pouvez récupérer en boutique, au créneau choisi, la viande halal commandée en ligne dans la journée.",
    transports: ["Métro A Gratte-Ciel", "Métro A Cusset", "Bus C3/C11"],
  },
  {
    slug: "tonkin",
    name: "Tonkin",
    citySlug: "villeurbanne",
    cityName: "Villeurbanne",
    zipCode: "69100",
    description:
      "Boucherie halal au Tonkin (Villeurbanne) : le quartier sur dalle près de la Doua, son accès en tramway et la commande de viande halal en click & collect.",
    context:
      "Le Tonkin, à l'ouest de Villeurbanne, entre Charpennes et le campus de la Doua, a été reconstruit dans les années 1960 et 1970 selon un urbanisme sur dalle, qui sépare la circulation des voitures de celle des piétons. Le quartier mêle familles installées de longue date, jeunes actifs et étudiants de l'INSA Lyon et de l'université Claude-Bernard Lyon 1, dont le campus LyonTech-la Doua est tout proche. Le parc de la Tête d'Or est à quelques minutes à pied, de l'autre côté du boulevard de Stalingrad. Le tramway T1 traverse le quartier et le relie au campus comme à la Part-Dieu, tandis que la station de métro Charpennes, au sud, donne accès aux lignes A et B. Entre les cours et le travail, la commande en ligne permet de choisir sa viande halal quand on a un moment, puis de la retirer en boutique au créneau choisi.",
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
      "Boucherie halal à la Villeneuve (Grenoble) : l'Arlequin, le parc Jean-Verlhac, le tram A et comment commander votre viande halal en click & collect.",
    context:
      "La Villeneuve est née dans les années 1970 au sud de Grenoble, dans le prolongement de la Villeneuve d'Échirolles. Conçue comme un projet urbain expérimental, elle associait logements, écoles, équipements et circulations piétonnes autour d'un grand parc, le parc Jean-Verlhac, créé en 1973. L'Arlequin, long immeuble dont la galerie piétonne serpente à travers le quartier, en est devenu le symbole. La Villeneuve fait aujourd'hui l'objet d'un vaste programme de renouvellement urbain, qui réhabilite les logements et réaménage le parc. Le tramway A dessert le quartier et le relie au centre de Grenoble ; le centre commercial Grand'Place est tout proche. Pour les familles du quartier comme pour celles et ceux qui y travaillent, la commande en click & collect permet de préparer ses achats de viande halal à l'avance et de les retirer en boutique au créneau choisi.",
    transports: ["Tram A La Bruyère", "Tram A Arlequin", "Bus C5/C7"],
  },
  {
    slug: "mistral",
    name: "Mistral",
    citySlug: "grenoble",
    cityName: "Grenoble",
    zipCode: "38100",
    description:
      "Boucherie halal à Mistral (Grenoble) : le quartier de l'ouest grenoblois entre Drac et A480, ses repères et la commande de viande halal en click & collect.",
    context:
      "Le quartier Mistral se trouve à l'ouest de Grenoble, dans le secteur 3, entre l'autoroute A480 et le Drac, la rivière qui borde la ville à l'ouest. Cette position, à l'écart des grands axes du centre, a longtemps isolé le quartier, voisin des Eaux-Claires. Depuis le début des années 2000, Mistral fait l'objet d'un projet de renouvellement urbain et social mené par la Ville de Grenoble et la Métropole : réhabilitation et reconstruction de logements, nouveaux espaces publics, nouveaux équipements et accès améliorés vers le reste de la ville. Des espaces verts et des îlots de fraîcheur y ont aussi été aménagés ces dernières années. Pour les habitants de Mistral et des quartiers voisins, la commande en ligne permet de choisir sa viande halal à l'avance, sans faire plusieurs détours, puis de la récupérer en boutique au créneau choisi.",
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
      "Boucherie halal à Tarentaize (Saint-Étienne) : le quartier ancien aux portes du centre-ville et comment commander votre viande halal en click & collect.",
    context:
      "Tarentaize, souvent associé à Beaubrun, est l'un des quartiers anciens de Saint-Étienne, aux portes du centre-ville. Marqué par l'histoire industrielle et minière de la ville, il a accueilli plusieurs générations de familles ouvrières venues travailler dans les mines et les usines stéphanoises. Le quartier fait aujourd'hui partie du projet « Cœur d'histoire », lancé par la Ville à la fin de 2018 pour redonner vie aux quartiers anciens du centre, de la place Albert-Thomas à Tarentaize ; plusieurs ensembles de logements y ont été réhabilités. La médiathèque de Tarentaize et la proximité du centre en font un quartier de vie, où l'on fait ses courses à pied. Pour vos achats de viande halal, la commande en ligne permet de préparer votre panier à l'avance et de le récupérer en boutique au créneau choisi.",
    transports: ["Tram T1 Tarentaize", "Bus M3"],
  },
  {
    slug: "bellevue",
    name: "Bellevue",
    citySlug: "saint-etienne",
    cityName: "Saint-Étienne",
    zipCode: "42100",
    description:
      "Boucherie halal à Bellevue (Saint-Étienne) : le quartier du sud stéphanois, son pôle tram, bus et TER, et la commande de viande halal en click & collect.",
    context:
      "Bellevue se trouve au sud du centre de Saint-Étienne. C'est un quartier résidentiel et commerçant, organisé autour d'un pôle d'échanges où se croisent le tramway, plusieurs lignes de bus et la gare SNCF de Saint-Étienne-Bellevue. Ce carrefour en fait un point de passage quotidien pour les habitants du sud stéphanois et des communes voisines qui rejoignent le centre-ville ou en reviennent. Les pentes qui l'entourent rappellent que Saint-Étienne est une ville de collines, aux portes du massif du Pilat. Pour les familles comme pour celles et ceux qui passent par Bellevue en rentrant du travail, la commande en ligne permet de choisir sa viande halal à l'avance et de la retirer en boutique au créneau choisi, sur le chemin du retour.",
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
      "Boucherie halal à Chambéry-le-Haut : les Hauts-de-Chambéry en bref, l'accès en bus depuis le centre et la commande de viande halal en click & collect.",
    context:
      "Chambéry-le-Haut, aussi appelé les Hauts-de-Chambéry, occupe le plateau au nord de la ville. Le quartier est né d'une zone à urbaniser en priorité (ZUP) étudiée dès 1962, rendue possible par le rattachement de Chambéry-le-Vieux à Chambéry en 1960 ; les premiers habitants s'y sont installés en 1967. Son plan d'ensemble, dessiné par les architectes Jean Dubuisson et Jean-Claude Saint-Maurice, associait logements, écoles, collège, lycée, équipements sportifs et centres commerciaux. Classé quartier prioritaire de la politique de la ville, il fait l'objet d'un programme de renouvellement urbain qui réhabilite une grande partie des logements. Des lignes de bus le relient au centre de Chambéry. Depuis les Hauts, la commande en ligne permet de choisir sa viande halal à l'avance et de la retirer en boutique au créneau choisi, sans multiplier les allers-retours.",
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
