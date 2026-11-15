import type { SeoCityData, SeoDepartmentData } from "./types";

export const RHONE_DEPARTMENT: SeoDepartmentData = {
  slug: "rhone",
  name: "Rhône",
  region: "Auvergne-Rhône-Alpes",
  description:
    "Boucheries halal dans le Rhône : Lyon, Villeurbanne, Vénissieux, Vaulx-en-Velin, Bron, Saint-Priest. Avec Klik&Go, commande à l'avance et paiement en boutique.",
  context:
    "Lyon, préfecture du Rhône, s'étend au confluent du Rhône et de la Saône, au cœur de la métropole de Lyon. Autour d'elle, Villeurbanne, Vaulx-en-Velin, Bron, Vénissieux, Saint-Priest, Décines-Charpieu, Meyzieu et Rillieux-la-Pape prolongent l'agglomération à l'est et au nord, tandis qu'Oullins et Givors la referment au sud, le long du Rhône. Le métro, le tram et les bus TCL relient ces communes au centre de Lyon. Klik&Go consacre une page à chacune d'elles. Avec Klik&Go, la viande halal se commande à l'avance, se retire au créneau choisi et se paie en boutique, sans frais de service, du repas de semaine à l'Aïd al-Adha.",
};

export const RHONE_CITIES: readonly SeoCityData[] = [
  {
    slug: "lyon",
    name: "Lyon",
    description:
      "Boucherie halal à Lyon, de la Guillotière à Vaise et à la Croix-Rousse : avec Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.764,
    longitude: 4.8357,
    districts: [
      "La Guillotière",
      "Vaise",
      "Croix-Rousse",
      "Gerland",
      "Villeurbanne",
      "Vénissieux",
      "Vaulx-en-Velin",
      "Bron",
    ],
    localContext:
      "Lyon, préfecture du Rhône et chef-lieu de la région Auvergne-Rhône-Alpes, s'étend au confluent du Rhône et de la Saône. De la Guillotière, avec la place Gabriel-Péri et ses commerces, à Gerland, à Vaise ou à la Croix-Rousse et son marché, la ville se prolonge vers Villeurbanne, Vénissieux, Vaulx-en-Velin et Bron, reliées par le métro et le tram. Commander sa viande halal à l'avance sur Klik&Go permet de passer au créneau choisi, sans tourner dans le quartier, et de la payer en boutique, sans frais de service, pour le quotidien comme pour le Ramadan et l'Aïd.",
    specialty: "merguez pour le couscous, agneau, brochettes, volailles",
  },
  {
    slug: "villeurbanne",
    name: "Villeurbanne",
    description:
      "Boucherie halal à Villeurbanne, des Gratte-Ciel à Cusset et Tonkin : sur Klik&Go, la viande se commande à l'avance et se paie en boutique, au créneau choisi.",
    latitude: 45.7665,
    longitude: 4.8795,
    districts: ["Gratte-Ciel", "Tonkin", "Cusset", "Charpennes", "La Ferrandière"],
    localContext:
      "Villeurbanne, voisine de Lyon à l'est, est connue pour les Gratte-Ciel, ensemble des années 1930, et pour le campus de la Doua, qui accueille l'INSA Lyon et l'université Claude-Bernard Lyon 1. Des Charpennes à Cusset, de Tonkin à la Ferrandière, la ville est desservie par le métro A et par le tram. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi entre deux cours ou après le travail, et de la payer en boutique, sans frais de service.",
    specialty: "merguez pour le couscous, viande pour kefta, agneau, volailles",
  },
  {
    slug: "venissieux",
    name: "Vénissieux",
    description:
      "Boucherie halal à Vénissieux, des Minguettes à Parilly : Klik&Go permet de commander à l'avance, de retirer au créneau choisi et de payer sur place, sans frais.",
    latitude: 45.6975,
    longitude: 4.8867,
    districts: ["Les Minguettes", "Centre-ville", "Parilly", "Moulin-à-Vent"],
    localContext:
      "Vénissieux, au sud-est de Lyon, s'étend des Minguettes, sur le plateau, au centre-ville, à Parilly et au Moulin-à-Vent. Le métro D, qui s'arrête à Parilly et à la gare de Vénissieux, et le tram T4 la relient au centre de Lyon. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, pour le repas du quotidien comme pour le Ramadan ou l'Aïd al-Adha, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, bœuf, viande hachée pour les merguez et la kefta",
  },
  {
    slug: "vaulx-en-velin",
    name: "Vaulx-en-Velin",
    description:
      "Boucherie halal à Vaulx-en-Velin, du Mas du Taureau à la Soie : sur Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique, sans frais.",
    latitude: 45.7779,
    longitude: 4.9201,
    districts: ["Mas du Taureau", "Centre-ville", "La Soie", "Grand Vire"],
    localContext:
      "Vaulx-en-Velin, à l'est de Villeurbanne, s'étend du Mas du Taureau au centre-ville, jusqu'au Carré de Soie, où le métro A a son terminus. La ville abrite un planétarium et borde le Grand Parc de Miribel-Jonage. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, en semaine comme pendant le Ramadan, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour kefta, brochettes, bœuf",
  },
  {
    slug: "bron",
    name: "Bron",
    description:
      "Boucherie halal à Bron, du Terraillon aux Essarts : avec Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie en boutique.",
    latitude: 45.7361,
    longitude: 4.9128,
    districts: ["Centre-ville", "Parilly", "Terraillon", "Les Essarts"],
    localContext:
      "Bron, à l'est de Lyon, est connue pour le parc de Parilly, son hippodrome et l'aéroport de Lyon-Bron, ainsi que pour le campus Porte des Alpes de l'université Lumière Lyon 2. Ses quartiers vont du Terraillon aux Essarts, et le tram T2 relie la ville au centre de Lyon. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en rentrant du travail ou de la fac, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande hachée, brochettes, escalopes de poulet",
  },
  {
    slug: "saint-priest",
    name: "Saint-Priest",
    description:
      "Boucherie halal à Saint-Priest, de Bel-Air à Manissieux : commande à l'avance sur Klik&Go, retrait au créneau choisi, paiement en boutique, sans frais.",
    latitude: 45.6968,
    longitude: 4.9408,
    districts: ["Centre-ville", "Bel-Air", "Manissieux", "Revaison"],
    localContext:
      "Saint-Priest, au sud-est de Lyon, s'étend du centre-ville et de son château à Bel-Air, Revaison et Manissieux, entre quartiers résidentiels et grands parcs d'activités. Le tram T2 la relie à Bron et au centre de Lyon. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi à la sortie du travail et de la payer en boutique, sans frais de service, pour le quotidien comme pour l'Aïd.",
    specialty: "viande à griller, agneau, bœuf, kefta",
  },
  {
    slug: "meyzieu",
    name: "Meyzieu",
    description:
      "Boucherie halal à Meyzieu, près du Grand Large : sur Klik&Go, on commande sa viande à l'avance, on passe au créneau choisi et on paie en boutique, sans frais.",
    latitude: 45.7681,
    longitude: 5.0028,
    districts: ["Centre-ville", "Plan d'Eau", "Mathiolan"],
    localContext:
      "Meyzieu, à l'est de la métropole lyonnaise, s'étend entre le canal de Jonage, le lac du Grand Large et le Grand Parc de Miribel-Jonage. Le tram T3 la relie à la Part-Dieu, et ses quartiers résidentiels côtoient une zone industrielle. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, par exemple avant une sortie au Grand Large, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, brochettes pour les grillades, viande hachée, volailles",
  },
  {
    slug: "rillieux-la-pape",
    name: "Rillieux-la-Pape",
    description:
      "Boucherie halal à Rillieux-la-Pape, de la Ville Nouvelle à Crépieux : avec Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.8181,
    longitude: 4.8983,
    districts: ["Ville Nouvelle", "Crépieux", "Vancia", "Le Loup Pendu"],
    localContext:
      "Rillieux-la-Pape, au nord de Lyon, s'étend sur le plateau qui domine la vallée du Rhône, de la Ville Nouvelle à Vancia, et descend vers Crépieux-la-Pape, au bord du fleuve. Commune de la métropole de Lyon, elle reste à quelques kilomètres de la Croix-Rousse et de Villeurbanne. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour les plats mijotés, bœuf, volailles",
  },
  {
    slug: "givors",
    name: "Givors",
    description:
      "Boucherie halal à Givors, au confluent du Rhône et du Gier : Klik&Go permet de commander à l'avance et de payer sa viande en boutique, au créneau choisi.",
    latitude: 45.5856,
    longitude: 4.7689,
    districts: ["Centre-ville", "Vernes", "Bans"],
    localContext:
      "Givors, au sud de la métropole de Lyon, s'étend au confluent du Rhône et du Gier, au départ de l'A47 vers Saint-Étienne. Son centre est marqué par les Étoiles, ensemble de logements en terrasses conçu par l'architecte Jean Renaudie, et la ville garde le souvenir de sa verrerie. Des Vernes au centre-ville, commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, bœuf",
  },
  {
    slug: "oullins",
    name: "Oullins",
    description:
      "Boucherie halal à Oullins, de la Saulaie au centre : sur Klik&Go, la commande se fait à l'avance, le retrait au créneau choisi et le paiement en boutique.",
    latitude: 45.7144,
    longitude: 4.8086,
    districts: ["Centre", "La Saulaie", "Pierre-Bénite"],
    localContext:
      "Oullins, au sud-ouest de Lyon, s'étend le long de l'Yzeron jusqu'au Rhône, du centre-ville à la Saulaie, près de la gare d'Oullins desservie par le métro B. Ville résidentielle et commerçante, elle est à quelques stations du centre de Lyon. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en rentrant du travail et de la payer en boutique, sans frais de service.",
    specialty: "agneau, brochettes, viande hachée, volailles",
  },
  {
    slug: "decines-charpieu",
    name: "Décines-Charpieu",
    description:
      "Boucherie halal à Décines-Charpieu, de Décines à Charpieu : avec Klik&Go, commande à l'avance, retrait au créneau choisi et paiement en boutique, sans frais.",
    latitude: 45.7706,
    longitude: 4.9586,
    districts: ["Centre", "Le Sept-Chemins", "La Mouche"],
    localContext:
      "Décines-Charpieu, à l'est de Lyon, accueille le Groupama Stadium et s'étend jusqu'au canal de Jonage et au lac du Grand Large, qu'elle partage avec Meyzieu. Le tram T3 la relie à la Part-Dieu, et la commune réunit le centre de Décines et le bourg de Charpieu. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, un jour de match comme en semaine, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour kefta, brochettes, bœuf",
  },
];
