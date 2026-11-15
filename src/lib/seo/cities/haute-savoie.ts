import type { SeoCityData, SeoDepartmentData } from "./types";

export const HAUTE_SAVOIE_DEPARTMENT: SeoDepartmentData = {
  slug: "haute-savoie",
  name: "Haute-Savoie",
  region: "Auvergne-Rhône-Alpes",
  description:
    "Boucheries halal en Haute-Savoie : Annecy, Annemasse, Thonon-les-Bains, Cluses. Klik&Go permet de commander à l'avance et de payer en boutique au retrait.",
  context:
    "La Haute-Savoie, entre le lac Léman, la Suisse et le massif du Mont-Blanc, réunit plusieurs bassins de vie : Annecy et son lac, le Genevois autour d'Annemasse, le Chablais autour de Thonon-les-Bains et la vallée de l'Arve, où se trouve Cluses. L'A41, l'A40 et le Léman Express relient plusieurs de ces villes à Genève. Klik&Go consacre une page à Annecy, Annemasse, Thonon-les-Bains et Cluses. Sur Klik&Go, la commande se fait à l'avance, le retrait au créneau choisi et le paiement en boutique, sans frais de service, pour le quotidien comme pour l'Aïd.",
};

export const HAUTE_SAVOIE_CITIES: readonly SeoCityData[] = [
  {
    slug: "annecy",
    name: "Annecy",
    description:
      "Boucherie halal à Annecy, Seynod, Cran-Gevrier ou Annecy-le-Vieux : sur Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.8992,
    longitude: 6.1294,
    districts: ["Annecy-le-Vieux", "Cran-Gevrier", "Seynod", "Meythet", "Pringy"],
    localContext:
      "Annecy, préfecture de la Haute-Savoie, s'étend au bord du lac d'Annecy et regroupe depuis 2017 Annecy-le-Vieux, Cran-Gevrier, Meythet, Pringy et Seynod au sein d'une même commune. La vieille ville, ses canaux et le Thiou lui valent le surnom de « Venise des Alpes ». Entre le centre, les quartiers résidentiels et les zones d'activités de l'agglomération, commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, que ce soit pour un pique-nique au bord du lac ou pour l'Aïd.",
    specialty: "agneau, viande à griller pour les pique-niques au bord du lac, volailles",
  },
  {
    slug: "annemasse",
    name: "Annemasse",
    description:
      "Boucherie halal à Annemasse, près de Genève : avec Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie en boutique, sans frais.",
    latitude: 46.1934,
    longitude: 6.2349,
    districts: ["Centre", "Vétraz-Monthoux", "Romagny"],
    localContext:
      "Annemasse, en Haute-Savoie, touche la frontière suisse et fait partie de l'agglomération du Grand Genève ; sa gare est desservie par le Léman Express, qui la relie à Genève. Ville-centre d'Annemasse Agglo, elle se prolonge vers Ambilly, Gaillard et Vétraz-Monthoux. Pour les frontaliers comme pour les familles, commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en rentrant du travail et de la payer en boutique, sans frais de service.",
    specialty: "agneau, bœuf, viande à griller, volailles",
  },
  {
    slug: "thonon-les-bains",
    name: "Thonon-les-Bains",
    description:
      "Boucherie halal à Thonon-les-Bains, au bord du Léman : sur Klik&Go, commande à l'avance, retrait au créneau choisi et paiement en boutique, sans frais.",
    latitude: 46.3719,
    longitude: 6.4781,
    districts: ["Centre", "Châtelard", "Concise"],
    localContext:
      "Thonon-les-Bains, sous-préfecture de la Haute-Savoie et ville historique du Chablais, domine la rive sud du lac Léman ; un funiculaire relie le centre-ville au port de Rives. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, par exemple avant une sortie au bord du lac, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, volailles",
  },
  {
    slug: "cluses",
    name: "Cluses",
    description:
      "Boucherie halal à Cluses, dans la vallée de l'Arve : Klik&Go permet de commander à l'avance, de passer au créneau choisi et de payer sa viande en boutique.",
    latitude: 46.0628,
    longitude: 6.5825,
    districts: ["Centre", "Sardagne", "Saint-Vincent"],
    localContext:
      "Cluses, dans la vallée de l'Arve entre Genève et Chamonix, est un centre de l'industrie du décolletage, héritière de l'horlogerie qui a marqué l'histoire de la ville. Avec Marnaz, Scionzier et Thyez, elle forme une agglomération industrielle desservie par l'A40. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, par exemple en fin de poste, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, bœuf",
  },
];
