import type { SeoCityData, SeoDepartmentData } from "./types";

export const ISERE_DEPARTMENT: SeoDepartmentData = {
  slug: "isere",
  name: "Isère",
  region: "Auvergne-Rhône-Alpes",
  description:
    "Boucheries halal en Isère : Grenoble, Échirolles, Saint-Martin-d'Hères, Fontaine, Voiron, Bourgoin-Jallieu, Vienne. Commande à l'avance et paiement en boutique.",
  context:
    "L'Isère s'étend de la vallée du Rhône aux Alpes. Grenoble et sa métropole, avec Échirolles, Saint-Martin-d'Hères et Fontaine, en forment le cœur urbain, entre la Chartreuse, le Vercors et Belledonne ; Voiron est la ville-centre du pays voironnais, Bourgoin-Jallieu celle du Nord-Isère, sur l'axe de l'A43 entre Lyon et Chambéry, et Vienne se trouve au bord du Rhône, au sud de Lyon. Klik&Go consacre une page à chacune de ces villes. Commander sa viande halal à l'avance sur Klik&Go permet de choisir son créneau de retrait et de payer en boutique, sans frais de service, y compris pendant le Ramadan.",
};

export const ISERE_CITIES: readonly SeoCityData[] = [
  {
    slug: "grenoble",
    name: "Grenoble",
    description:
      "Boucherie halal à Grenoble, de Saint-Bruno à la Villeneuve et Mistral : avec Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.1885,
    longitude: 5.7245,
    districts: ["Villeneuve", "Mistral", "Teisseire", "Arlequin", "Saint-Bruno", "Echirolles"],
    localContext:
      "Grenoble, préfecture de l'Isère, s'étend au confluent du Drac et de l'Isère, encadrée par la Chartreuse, le Vercors et Belledonne. Des marchés de Saint-Bruno et de l'Estacade aux quartiers de la Villeneuve, de l'Arlequin, de Mistral et de Teisseire, la ville se prolonge vers Échirolles, Fontaine et Saint-Martin-d'Hères, que relient les lignes de tram. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, avant ou après le travail, et de la payer en boutique, sans frais de service, pour le quotidien comme pour le Ramadan et l'Aïd.",
    specialty: "agneau, viande hachée pour la kefta, volailles, brochettes",
  },
  {
    slug: "echirolles",
    name: "Échirolles",
    description:
      "Boucherie halal à Échirolles, du Village 2 aux Essarts : sur Klik&Go, la viande se commande à l'avance et se paie en boutique, au créneau choisi, sans frais.",
    latitude: 45.1467,
    longitude: 5.7142,
    districts: ["Village 2", "La Luire", "Essarts", "Centre"],
    localContext:
      "Échirolles, commune de la métropole grenobloise au sud de Grenoble, réunit des quartiers comme le Village 2, les Essarts, Surieux et la Luire, desservis par le tram A et proches du centre commercial Grand'Place. La ville abrite aussi le musée Géo-Charles. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, pour le quotidien comme pour l'Aïd.",
    specialty: "agneau, viande pour tajine, brochettes, volailles",
  },
  {
    slug: "saint-martin-dheres",
    name: "Saint-Martin-d'Hères",
    description:
      "Boucherie halal à Saint-Martin-d'Hères, près du campus : commande à l'avance sur Klik&Go, retrait au créneau choisi, paiement en boutique, sans frais.",
    latitude: 45.1729,
    longitude: 5.7575,
    districts: ["Champberton", "Galochère", "Renaudie", "Université"],
    localContext:
      "Saint-Martin-d'Hères, à l'est de Grenoble, accueille l'essentiel du domaine universitaire de Grenoble, partagé avec Gières et desservi par le tram. Des quartiers de Renaudie et Champberton à la Galochère, la ville mêle logements étudiants, familles et zones d'activités. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi entre deux cours ou après le travail, et de la payer en boutique, sans frais de service.",
    specialty: "viande hachée, escalopes de poulet, brochettes, agneau",
  },
  {
    slug: "fontaine",
    name: "Fontaine",
    description:
      "Boucherie halal à Fontaine, rive gauche du Drac : Klik&Go permet de commander sa viande à l'avance, de la retirer au créneau choisi et de payer en boutique.",
    latitude: 45.1944,
    longitude: 5.685,
    districts: ["Centre", "Bastille", "Bouvignier"],
    localContext:
      "Fontaine, sur la rive gauche du Drac à l'ouest de Grenoble, s'étend au pied du Vercors, entre Sassenage et Seyssinet-Pariset. Reliée à Grenoble par le tram A, elle mêle centre-ville commerçant et quartiers résidentiels. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en rentrant du travail et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, volailles",
  },
  {
    slug: "voiron",
    name: "Voiron",
    description:
      "Boucherie halal à Voiron et dans le pays voironnais : avec Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie en boutique.",
    latitude: 45.3654,
    longitude: 5.5901,
    districts: ["Centre", "Brunetière", "Sermorens"],
    localContext:
      "Voiron, ville-centre du pays voironnais, se trouve au nord-ouest de Grenoble, entre le massif de la Chartreuse et le lac de Paladru, le long de l'A48 qui mène vers Lyon. L'église Saint-Bruno domine le centre-ville. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, sur le trajet entre Grenoble et la maison, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour les plats mijotés, bœuf, volailles",
  },
  {
    slug: "bourgoin-jallieu",
    name: "Bourgoin-Jallieu",
    description:
      "Boucherie halal à Bourgoin-Jallieu, dans le Nord-Isère : sur Klik&Go, commande à l'avance, retrait au créneau choisi et paiement en boutique, sans frais.",
    latitude: 45.5859,
    longitude: 5.2725,
    districts: ["Centre", "Champaret", "Champ Fleuri", "Pré Bénit"],
    localContext:
      "Bourgoin-Jallieu, dans le Nord-Isère, s'étend le long de l'A43 entre Lyon et Chambéry, au sein de l'agglomération Porte de l'Isère, aux côtés de L'Isle-d'Abeau et de Villefontaine. Ville de rugby, elle réunit les anciennes communes de Bourgoin et de Jallieu. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, au retour de Lyon ou du travail, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, bœuf, volailles",
  },
  {
    slug: "vienne",
    name: "Vienne",
    description:
      "Boucherie halal à Vienne, au bord du Rhône : Klik&Go permet de commander sa viande à l'avance, de passer au créneau choisi et de régler en boutique, sans frais.",
    latitude: 45.524,
    longitude: 4.8744,
    districts: ["Centre", "Estressin", "Malissol"],
    localContext:
      "Vienne, sous-préfecture de l'Isère, s'étend sur la rive gauche du Rhône, au sud de Lyon. Le temple d'Auguste et de Livie et le théâtre antique, qui accueille chaque été le festival Jazz à Vienne, témoignent de son passé romain. Ville-centre de Vienne Condrieu Agglomération, elle se prolonge vers Estressin et Malissol. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, brochettes, bœuf",
  },
];
