import type { SeoCityData, SeoDepartmentData } from "./types";

// Savoie, part 1: the department itself, then Chambéry and the communes of its
// agglomeration. Aix-les-Bains, the lake and the valleys are in savoie-lac-vallees.ts.

export const SAVOIE_DEPARTMENT: SeoDepartmentData = {
  slug: "savoie",
  name: "Savoie",
  region: "Auvergne-Rhône-Alpes",
  description:
    "Boucheries halal en Savoie : Chambéry, Aix-les-Bains, Albertville, Montmélian et leurs communes. Sur Klik&Go, commande à l'avance et paiement en boutique.",
  context:
    "La Savoie s'organise autour de la cluse de Chambéry, du lac du Bourget et d'Aix-les-Bains, de l'Avant-Pays savoyard et des grandes vallées alpines : combe de Savoie, Tarentaise, Maurienne et Beaufortain. Chambéry, la préfecture, et Aix-les-Bains sont les villes-centres de deux agglomérations voisines, Grand Chambéry et Grand Lac, reliées par l'A41 et la voie rapide urbaine. Klik&Go consacre une page à Chambéry et à ses communes voisines, à Aix-les-Bains et aux communes du lac, ainsi qu'à Montmélian, Albertville, Saint-Jean-de-Maurienne, Yenne et Pont-de-Beauvoisin. Avec Klik&Go, la viande halal se commande à l'avance, se retire au créneau choisi et se paie en boutique, sans frais de service.",
};

export const SAVOIE_CHAMBERY_CITIES: readonly SeoCityData[] = [
  {
    slug: "chambery",
    name: "Chambéry",
    description:
      "Boucherie halal à Chambéry, du centre-ville à Bissy et Chambéry-le-Haut : avec Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.5646,
    longitude: 5.9178,
    districts: [
      "Centre-ville",
      "Chambéry-le-Haut",
      "Bissy",
      "Cognin",
      "La Motte-Servolex",
      "Bassens",
      "Saint-Alban-Leysse",
      "Barberaz",
      "La Ravoire",
      "Challes-les-Eaux",
      "Jacob-Bellecombette",
    ],
    localContext:
      "Chambéry, préfecture de la Savoie et ville-centre de Grand Chambéry, occupe la cluse qui sépare le massif des Bauges de celui de la Chartreuse, au sud du lac du Bourget. Le centre historique, autour du château des ducs de Savoie et de la fontaine des Éléphants, se prolonge vers Chambéry-le-Haut au nord et vers Bissy à l'ouest ; l'agglomération continue à Cognin, La Motte-Servolex, Bassens, Saint-Alban-Leysse, Barberaz, La Ravoire, Challes-les-Eaux et Jacob-Bellecombette. L'A43 relie la ville à Lyon et à la Maurienne, l'A41 à Grenoble et à Annecy, et la voie rapide urbaine traverse l'agglomération. La gare de Chambéry–Challes-les-Eaux dessert Lyon, Grenoble, Annecy et Paris, et l'Université Savoie Mont Blanc a deux de ses campus à Jacob-Bellecombette et au Bourget-du-Lac. Commander à l'avance permet de choisir son créneau de retrait et de préparer sereinement le Ramadan, l'Aïd al-Fitr ou l'Aïd al-Adha, la fête du sacrifice. Le paiement se fait en boutique, au retrait, sans frais de service.",
    specialty:
      "gigot et épaule d'agneau pour l'Aïd al-Adha, viande pour tajine, brochettes, merguez, kefta, viande hachée, escalopes de veau",
  },
  {
    slug: "bissy",
    name: "Bissy",
    description:
      "Vous cherchez une boucherie halal à Bissy, à l'ouest de Chambéry ? Sur Klik&Go, la viande se commande à l'avance et se paie en boutique, sans frais de service.",
    latitude: 45.5742,
    longitude: 5.8867,
    districts: ["Zone industrielle Bissy", "Bissy-village"],
    localContext:
      "Bissy forme le quartier ouest de Chambéry : autour de Bissy-village s'étendent des rues résidentielles et la zone d'activités de Bissy, desservie par la voie rapide urbaine, à quelques minutes de Cognin, de La Motte-Servolex et du centre de Chambéry. Pour qui travaille dans la zone, commander sa viande halal à l'avance pendant la pause et la retirer au créneau choisi en fin de journée évite un détour. Le paiement se fait en boutique, au moment du retrait.",
    specialty:
      "brochettes et viande à griller, viande hachée, escalopes de poulet pour les repas de la semaine",
  },
  {
    slug: "cognin",
    name: "Cognin",
    description:
      "Boucherie halal à Cognin, aux portes de Chambéry : commande de viande à l'avance sur Klik&Go, retrait au créneau choisi, paiement en boutique, sans frais.",
    latitude: 45.5599,
    longitude: 5.8861,
    districts: ["Centre Cognin", "Beauvoir", "Plainpalais"],
    localContext:
      "Cognin, commune de Grand Chambéry limitrophe de Chambéry à l'ouest, marque l'entrée ouest de l'agglomération, entre Bissy, Jacob-Bellecombette et les hauteurs de Vimines. Résidentielle, avec ses écoles et ses commerces de proximité, elle reste à quelques minutes du centre chambérien. Commandée à l'avance, la viande halal se retire au créneau choisi en rentrant du travail et se paie en boutique, sans frais de service. Pour le Ramadan ou l'Aïd al-Adha, réserver tôt permet d'organiser sereinement les repas de famille.",
    specialty: "agneau pour tajine et grillades, viande hachée, volailles",
  },
  {
    slug: "la-motte-servolex",
    name: "La Motte-Servolex",
    description:
      "Trouver une boucherie halal à La Motte-Servolex, entre Chambéry et le lac du Bourget : sur Klik&Go, on commande à l'avance et on paie au retrait en boutique.",
    latitude: 45.5933,
    longitude: 5.8761,
    districts: ["Centre", "Reignier", "Belledonne"],
    localContext:
      "La Motte-Servolex, voisine de Chambéry au nord-ouest et membre de Grand Chambéry, s'étend entre Chambéry et le lac du Bourget. Commune étendue, elle mêle bourg, hameaux et quartiers résidentiels, reliés au centre de Chambéry et à Bissy par la voie rapide urbaine. Commander sa viande halal à l'avance sur Klik&Go permet de la récupérer au créneau choisi sur le trajet du travail ou de l'école, puis de la payer en boutique, sans frais de service.",
    specialty: "agneau, bœuf à braiser, volailles, brochettes pour les grillades",
  },
  {
    slug: "la-ravoire",
    name: "La Ravoire",
    description:
      "Boucherie halal à La Ravoire, vers Challes-les-Eaux : Klik&Go permet de commander sa viande à l'avance, de la retirer au créneau choisi et de payer sur place.",
    latitude: 45.5544,
    longitude: 5.9533,
    districts: ["Centre", "Vallon", "Mâche", "Féjaz"],
    localContext:
      "La Ravoire prolonge Chambéry au sud-est, sur l'axe qui mène à Challes-les-Eaux, à Montmélian et à la combe de Savoie. Commune de Grand Chambéry, elle mêle quartiers résidentiels et commerces le long de cet axe, à quelques minutes de Barberaz et de Saint-Baldoph. Pour les familles comme pour les actifs, commander à l'avance sur Klik&Go permet de retirer sa viande halal au créneau choisi, sur le trajet du quotidien ; le paiement se fait en boutique, sans frais de service.",
    specialty: "agneau, kefta, brochettes, volailles",
  },
  {
    slug: "barberaz",
    name: "Barberaz",
    description:
      "Boucherie halal à Barberaz, entre Chambéry et La Ravoire : sur Klik&Go, la commande se passe à l'avance, le retrait au créneau choisi, le paiement en boutique.",
    latitude: 45.5631,
    longitude: 5.9489,
    districts: ["Centre", "Pré Hibou", "Mérande"],
    localContext:
      "Barberaz, commune résidentielle de Grand Chambéry, s'étend entre Chambéry et La Ravoire, au sud-est de la ville. Sa position permet de rejoindre en quelques minutes le centre de Chambéry comme l'axe qui mène vers Challes-les-Eaux et Montmélian. Commander sa viande halal à l'avance sur Klik&Go permet de choisir son créneau de retrait et de payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour kefta, brochettes, volailles",
  },
  {
    slug: "bassens",
    name: "Bassens",
    description:
      "Boucherie halal à Bassens, entre Chambéry-le-Haut et Saint-Alban-Leysse : avec Klik&Go, commande à l'avance, retrait au créneau choisi, sans frais de service.",
    latitude: 45.5894,
    longitude: 5.9442,
    districts: ["Centre", "Les Combes", "Le Villard"],
    localContext:
      "Bassens, commune de Grand Chambéry, s'étend au nord-est de Chambéry, entre Chambéry-le-Haut et Saint-Alban-Leysse. Ses quartiers résidentiels sont à quelques minutes du centre-ville et des accès à la voie rapide urbaine. Commander sa viande halal à l'avance sur Klik&Go permet de passer au créneau choisi, par exemple en rentrant du travail, et de payer en boutique, sans frais de service. Pour l'Aïd al-Adha, mieux vaut s'y prendre tôt.",
    specialty: "agneau pour l'Aïd, viande à griller, kefta, brochettes",
  },
  {
    slug: "saint-alban-leysse",
    name: "Saint-Alban-Leysse",
    description:
      "Boucherie halal à Saint-Alban-Leysse, au pied du Nivolet : sur Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie en boutique.",
    latitude: 45.5806,
    longitude: 5.9522,
    districts: ["Centre", "Plainpalais", "Croix-Rouge"],
    localContext:
      "Saint-Alban-Leysse, commune de Grand Chambéry traversée par la Leysse, s'étend à l'est de Chambéry, entre Bassens et Barberaz, au pied du Nivolet et de la croix qui domine la ville. C'est l'une des portes d'entrée du massif des Bauges. Pour ses habitants, commander à l'avance sur Klik&Go permet de retirer sa viande halal au créneau choisi et de la payer en boutique, sans frais de service, avant de remonter vers les hauteurs.",
    specialty: "bœuf et agneau pour les plats mijotés, brochettes, viande hachée",
  },
  {
    slug: "jacob-bellecombette",
    name: "Jacob-Bellecombette",
    description:
      "Étudiant ou habitant de Jacob-Bellecombette ? Côté boucherie halal, Klik&Go permet de commander à l'avance et de payer en boutique, au créneau choisi.",
    latitude: 45.5519,
    longitude: 5.9097,
    districts: ["Jacob", "Bellecombette", "Le Tremblay"],
    localContext:
      "Jacob-Bellecombette, commune de Grand Chambéry au sud de la ville, accueille le campus de Jacob de l'Université Savoie Mont Blanc, où se croisent étudiants, enseignants et familles. Les quartiers de Jacob et de Bellecombette s'étagent sur les hauteurs, à quelques minutes du centre de Chambéry. Pour un étudiant comme pour une famille, commander à l'avance sur Klik&Go permet de retirer sa viande halal au créneau choisi, entre deux cours ou après le travail, et de la payer en boutique.",
    specialty: "viande hachée, escalopes de poulet, brochettes et agneau pour les repas en famille",
  },
  {
    slug: "challes-les-eaux",
    name: "Challes-les-Eaux",
    description:
      "Boucherie halal à Challes-les-Eaux, au sud-est de Chambéry : commande à l'avance sur Klik&Go, retrait au créneau choisi et paiement en boutique, sans frais.",
    latitude: 45.545,
    longitude: 5.9764,
    districts: ["Centre", "Triviers", "Villaret"],
    localContext:
      "Challes-les-Eaux, commune de Grand Chambéry connue pour ses eaux thermales, s'étend au sud-est de Chambéry, après La Ravoire, sur la route de Montmélian et de la combe de Savoie, à quelques minutes du centre de Chambéry. Commander sa viande halal à l'avance sur Klik&Go permet de passer au créneau choisi et de payer en boutique, sans frais de service : pratique pour un repas de famille comme pour l'Aïd.",
    specialty: "agneau, viande à griller, volailles, brochettes",
  },
  {
    slug: "sonnaz",
    name: "Sonnaz",
    description:
      "Boucherie halal à Sonnaz, au nord de Chambéry : avec Klik&Go, on commande à l'avance et on récupère sa viande au créneau choisi, avec paiement en boutique.",
    latitude: 45.6097,
    longitude: 5.8867,
    districts: ["Le Bourg", "La Buisse"],
    localContext:
      "Sonnaz, commune de Grand Chambéry au nord de Chambéry, garde un caractère semi-rural entre prés, hameaux et lotissements, sur le chemin du lac du Bourget et d'Aix-les-Bains. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi lors d'un passage dans l'agglomération, puis de la payer en boutique, sans frais de service.",
    specialty: "agneau pour méchoui, volailles, viande à griller",
  },
  {
    slug: "vimines",
    name: "Vimines",
    description:
      "Boucherie halal près de Vimines, au-dessus de Cognin : Klik&Go permet de commander à l'avance, de passer au créneau choisi et de payer en boutique.",
    latitude: 45.5414,
    longitude: 5.8847,
    districts: ["Le Bourg", "Saint-Cassin"],
    localContext:
      "Vimines, commune de Grand Chambéry, s'étage sur les hauteurs au sud-ouest de Chambéry, au-dessus de Cognin, avec son bourg et ses hameaux. Résidentielle et calme, elle reste proche du centre de Chambéry. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en descendant en ville, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande pour kefta, brochettes, volailles",
  },
  {
    slug: "saint-cassin",
    name: "Saint-Cassin",
    description:
      "Boucherie halal pour Saint-Cassin, au sud-ouest de Chambéry : sur Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique, sans frais.",
    latitude: 45.5392,
    longitude: 5.8556,
    districts: ["Le Bourg"],
    localContext:
      "Saint-Cassin, petite commune de Grand Chambéry, se trouve sur les hauteurs au sud-ouest de Chambéry, voisine de Vimines, dans un cadre resté rural. Pour les achats du quotidien, l'agglomération chambérienne est toute proche : en commandant sa viande halal à l'avance sur Klik&Go, on la retire au créneau choisi lors d'un passage en ville et on la paie en boutique, sans frais de service.",
    specialty: "agneau pour l'Aïd, brochettes, viande hachée",
  },
  {
    slug: "saint-baldoph",
    name: "Saint-Baldoph",
    description:
      "Boucherie halal à Saint-Baldoph, au sud de Chambéry : avec Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie sur place.",
    latitude: 45.53,
    longitude: 5.9261,
    districts: ["Le Bourg", "Les Charmettes"],
    localContext:
      "Saint-Baldoph, commune de Grand Chambéry, s'étend au sud de Chambéry, au pied du massif de la Chartreuse, entre hameaux et quartiers résidentiels, à quelques minutes de Barberaz et de La Ravoire. Commander sa viande halal à l'avance sur Klik&Go permet de passer au créneau choisi en revenant de Chambéry et de payer en boutique, sans frais de service : utile pour les repas de famille comme pour préparer l'Aïd.",
    specialty: "agneau, viande à griller, kefta, volailles",
  },
];
