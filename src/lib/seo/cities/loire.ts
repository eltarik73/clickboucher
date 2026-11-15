import type { SeoCityData, SeoDepartmentData } from "./types";

export const LOIRE_DEPARTMENT: SeoDepartmentData = {
  slug: "loire",
  name: "Loire",
  region: "Auvergne-Rhône-Alpes",
  description:
    "Boucheries halal dans la Loire, de Saint-Étienne à Firminy et Roanne : avec Klik&Go, commande à l'avance, retrait au créneau choisi et paiement en boutique.",
  context:
    "La Loire s'étend du Roannais, au nord, au massif du Pilat, au sud, en passant par la plaine du Forez. Saint-Étienne, la préfecture, forme avec la vallée de l'Ondaine et Firminy l'ensemble urbain du sud du département, relié à Lyon par l'A47 ; Roanne, au bord de la Loire, est la ville-centre du Roannais. Klik&Go consacre une page à Saint-Étienne, à Firminy et à Roanne. Sur Klik&Go, on commande sa viande halal à l'avance, on la retire au créneau choisi et on la paie en boutique, sans frais de service.",
};

export const LOIRE_CITIES: readonly SeoCityData[] = [
  {
    slug: "saint-etienne",
    name: "Saint-Étienne",
    description:
      "Boucherie halal à Saint-Étienne, de Bellevue à Tarentaize et Montreynaud : sur Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.4397,
    longitude: 4.3872,
    districts: [
      "Bellevue",
      "Tarentaize",
      "Beaubrun",
      "Le Crêt-de-Roc",
      "Montreynaud",
      "Centre-Deux",
    ],
    localContext:
      "Saint-Étienne, préfecture de la Loire, est devenue en 2010 ville créative de design de l'UNESCO, avec sa Cité du design installée sur le site de l'ancienne Manufacture d'armes. De Bellevue à Tarentaize, de Beaubrun au Crêt-de-Roc et à Montreynaud, la ville garde l'empreinte de son passé minier, que raconte le musée de la Mine au puits Couriot. Un réseau de tram dessert la ville. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, pour le quotidien comme pour le Ramadan et l'Aïd.",
    specialty: "agneau, bœuf, viande à griller",
  },
  {
    slug: "roanne",
    name: "Roanne",
    description:
      "Boucherie halal à Roanne et dans le Roannais : avec Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie en boutique, sans frais.",
    latitude: 46.0367,
    longitude: 4.0689,
    districts: ["Centre", "Mâtel", "Le Bourg"],
    localContext:
      "Roanne, sous-préfecture de la Loire, s'étend au bord de la Loire, au nord du département, là où commence le canal de Roanne à Digoin. Ancienne ville du textile, elle est la ville-centre de Roannais Agglomération. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, pour le quotidien comme pour les fêtes de famille.",
    specialty: "agneau, bœuf, viande à griller",
  },
  {
    slug: "firminy",
    name: "Firminy",
    description:
      "Boucherie halal à Firminy, dans la vallée de l'Ondaine : Klik&Go permet de commander à l'avance, de retirer au créneau choisi et de payer en boutique.",
    latitude: 45.3878,
    longitude: 4.2867,
    districts: ["Centre", "Le Chambon-Feugerolles", "Vert-Bois"],
    localContext:
      "Firminy, au sud-ouest de Saint-Étienne dans la vallée de l'Ondaine, abrite le site Le Corbusier de Firminy-Vert, avec l'église Saint-Pierre et la Maison de la culture, inscrite au patrimoine mondial de l'UNESCO parmi les œuvres de l'architecte. Avec Le Chambon-Feugerolles et Unieux, la ville forme l'agglomération de l'Ondaine. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour les plats mijotés, brochettes",
  },
];
