import type { SeoCityData } from "./types";

// Savoie, part 2: Aix-les-Bains and the communes of the lac du Bourget, then the
// Avant-Pays savoyard, the combe de Savoie and the Alpine valleys. The department
// itself and the Chambéry agglomeration are in savoie-chambery.ts.

export const SAVOIE_LAC_VALLEES_CITIES: readonly SeoCityData[] = [
  {
    slug: "aix-les-bains",
    name: "Aix-les-Bains",
    description:
      "Boucherie halal à Aix-les-Bains, de Marlioz au Sierroz et à Lafin : sur Klik&Go, commande à l'avance, retrait au créneau choisi et paiement en boutique.",
    latitude: 45.6884,
    longitude: 5.9153,
    districts: [
      "Centre-ville",
      "Mémard",
      "Sierroz",
      "Marlioz",
      "Choudy",
      "Lafin",
      "Boucher",
      "Franklin Roosevelt",
      "Casino-Thermes",
      "Bois Vidal",
      "Liberté",
    ],
    localContext:
      "Aix-les-Bains, ville thermale de la rive est du lac du Bourget et ville-centre de Grand Lac, s'organise entre le centre, avec ses thermes et le casino Grand Cercle, l'esplanade du lac avec le Grand Port et le Petit Port, et les pentes qui montent vers le Revard. Du Grand Port partent les bateaux vers l'abbaye d'Hautecombe, sur la rive opposée. Autour du centre-ville, les quartiers de Marlioz, Mémard, Sierroz, Choudy, Lafin et Franklin-Roosevelt, puis les communes voisines de Grésy-sur-Aix, Tresserve, Mouxy, Brison-Saint-Innocent, Drumettaz-Clarafond et Pugny-Chatenod forment l'agglomération aixoise. La gare d'Aix-les-Bains-le-Revard et l'A41 relient la ville à Chambéry et à Annecy. Les pique-niques au bord du lac, le Ramadan, l'Aïd al-Fitr et l'Aïd al-Adha sont autant d'occasions de commander à l'avance : la viande halal se retire au créneau choisi et se paie en boutique, sans frais de service.",
    specialty:
      "agneau pour l'Aïd al-Adha, méchoui, brochettes et merguez pour les pique-niques au bord du lac, kefta, viande hachée, escalopes de veau, volailles",
  },
  {
    slug: "le-bourget-du-lac",
    name: "Le Bourget-du-Lac",
    description:
      "Le Bourget-du-Lac et Savoie Technolac : pour une boucherie halal, Klik&Go permet de commander à l'avance, de retirer au créneau choisi et de payer en boutique.",
    latitude: 45.6486,
    longitude: 5.8639,
    districts: ["Centre", "Bourdeau", "Le Tremblay"],
    localContext:
      "Le Bourget-du-Lac, à la pointe sud du lac du Bourget entre Chambéry et Aix-les-Bains, accueille le parc d'activités Savoie Technolac et un campus de l'Université Savoie Mont Blanc, où se croisent étudiants, chercheurs et salariés. Le bourg, son prieuré et sa plage attirent aussi promeneurs et familles aux beaux jours. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, après les cours ou le travail, et de la payer en boutique, sans frais de service.",
    specialty: "viande à griller, agneau, brochettes, volailles",
  },
  {
    slug: "voglans",
    name: "Voglans",
    description:
      "Boucherie halal à Voglans, entre Chambéry et Aix-les-Bains : avec Klik&Go, la viande se commande à l'avance et se retire au créneau choisi, payée en boutique.",
    latitude: 45.6228,
    longitude: 5.8825,
    districts: ["Le Bourg", "Les Iles"],
    localContext:
      "Voglans se trouve entre Chambéry et Aix-les-Bains, au sud du lac du Bourget, à proximité de l'aéroport Chambéry-Savoie-Mont-Blanc et de l'axe qui relie les deux villes. Pour qui fait ce trajet au quotidien, commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en chemin, puis de la payer en boutique, sans frais de service.",
    specialty: "agneau, brochettes, viande à griller pour l'été",
  },
  {
    slug: "drumettaz-clarafond",
    name: "Drumettaz-Clarafond",
    description:
      "Boucherie halal à Drumettaz-Clarafond, entre Aix-les-Bains et Chambéry : commande à l'avance sur Klik&Go, retrait au créneau choisi, sans frais de service.",
    latitude: 45.6486,
    longitude: 5.9094,
    districts: ["Drumettaz", "Clarafond", "La Brisolette"],
    localContext:
      "Drumettaz-Clarafond, commune de Grand Lac entre Aix-les-Bains et Chambéry, réunit les deux villages de Drumettaz et de Clarafond et des quartiers résidentiels, à quelques minutes d'Aix-les-Bains comme de l'agglomération chambérienne. Commander sa viande halal à l'avance sur Klik&Go permet de passer au créneau choisi d'un côté ou de l'autre, puis de payer en boutique, sans frais de service.",
    specialty: "agneau, brochettes pour les grillades d'été, viande pour méchoui",
  },
  {
    slug: "mery",
    name: "Méry",
    description:
      "Boucherie halal à Méry, au sud d'Aix-les-Bains : sur Klik&Go, on commande sa viande à l'avance, on la retire au créneau choisi et on la paie en boutique.",
    latitude: 45.6633,
    longitude: 5.9119,
    districts: ["Centre", "Saint-Maurice", "Champagneux"],
    localContext:
      "Méry, commune résidentielle de Grand Lac au sud d'Aix-les-Bains, se situe entre Aix-les-Bains et Chambéry, à quelques minutes de l'une comme de l'autre. Commander sa viande halal à l'avance sur Klik&Go permet de choisir son créneau de retrait selon son trajet du jour et de payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, kefta, viande hachée",
  },
  {
    slug: "tresserve",
    name: "Tresserve",
    description:
      "Boucherie halal à Tresserve, au bord du lac du Bourget : Klik&Go permet de commander à l'avance pour un pique-nique ou l'Aïd, avec paiement en boutique.",
    latitude: 45.6709,
    longitude: 5.8959,
    districts: ["Centre", "Le Plat", "Les Tournelles", "Pré Tampin"],
    localContext:
      "Tresserve s'étend sur une colline au sud d'Aix-les-Bains, en bordure du lac du Bourget. Commune résidentielle de Grand Lac, elle est toute proche de l'esplanade, des ports et des plages d'Aix-les-Bains. Pour un pique-nique au bord du lac, un repas de famille ou l'Aïd, commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique.",
    specialty: "agneau pour méchoui, brochettes, viande hachée, kefta, escalopes de poulet",
  },
  {
    slug: "gresy-sur-aix",
    name: "Grésy-sur-Aix",
    description:
      "Boucherie halal à Grésy-sur-Aix, au nord d'Aix-les-Bains : avec Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique, sans frais.",
    latitude: 45.7233,
    longitude: 5.9358,
    districts: ["Centre", "Antoger", "Le Mollard", "Saint-Victor", "Saint-Pierre"],
    localContext:
      "Grésy-sur-Aix, commune de Grand Lac au nord d'Aix-les-Bains, s'étend sur la route d'Annecy et est connue pour les gorges du Sierroz. Ses quartiers résidentiels sont à quelques minutes du centre d'Aix-les-Bains et de l'A41. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, pour le quotidien comme pour l'Aïd ou un mariage.",
    specialty: "agneau pour l'Aïd, viande à griller, méchoui, merguez",
  },
  {
    slug: "mouxy",
    name: "Mouxy",
    description:
      "Boucherie halal pour Mouxy, sur les hauteurs d'Aix-les-Bains : sur Klik&Go, la viande se commande à l'avance et se paie en boutique, au créneau choisi.",
    latitude: 45.6856,
    longitude: 5.9436,
    districts: ["Centre", "Le Tomet", "La Croix"],
    localContext:
      "Mouxy s'étage sur les premières pentes à l'est d'Aix-les-Bains, en direction du Revard, au-dessus du lac du Bourget. Petite commune résidentielle de Grand Lac, elle reste à quelques minutes du centre-ville aixois. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi lors d'un passage en ville, puis de la payer en boutique, sans frais de service.",
    specialty: "agneau pour l'Aïd, viande à griller, brochettes, merguez",
  },
  {
    slug: "pugny-chatenod",
    name: "Pugny-Chatenod",
    description:
      "Boucherie halal à Pugny-Chatenod, en direction du Revard : Klik&Go permet de commander à l'avance et de passer au créneau choisi, avec paiement en boutique.",
    latitude: 45.6961,
    longitude: 5.96,
    districts: ["Pugny", "Chatenod", "Le Mollard"],
    localContext:
      "Pugny-Chatenod, petite commune de Grand Lac, s'étend sur les pentes à l'est d'Aix-les-Bains, en direction du Revard, autour de ses deux villages, Pugny et Chatenod. Résidentielle et tranquille, elle se trouve à quelques minutes du centre aixois. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi en descendant en ville et de la payer en boutique, sans frais de service.",
    specialty: "agneau pour l'Aïd, méchoui, brochettes",
  },
  {
    slug: "brison-saint-innocent",
    name: "Brison-Saint-Innocent",
    description:
      "Boucherie halal à Brison-Saint-Innocent, rive est du lac du Bourget : commande à l'avance sur Klik&Go, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.7211,
    longitude: 5.8783,
    districts: ["Brison-les-Oliviers", "Saint-Innocent", "Grumeau", "Centre"],
    localContext:
      "Brison-Saint-Innocent longe la rive est du lac du Bourget, au nord d'Aix-les-Bains, avec ses villages de Brison et de Saint-Innocent. Commune de Grand Lac, elle compte le hameau de Brison-les-Oliviers, dont le nom évoque le climat doux de cette rive. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, pour un repas de famille comme pour une grande tablée.",
    specialty: "agneau pour méchoui, brochettes, viande pour les grandes tablées",
  },
  {
    slug: "albens",
    name: "Albens",
    description:
      "Boucherie halal à Albens (Entrelacs), entre Aix-les-Bains et Annecy : sur Klik&Go, commande à l'avance, retrait au créneau choisi et paiement en boutique.",
    latitude: 45.7886,
    longitude: 5.9483,
    districts: ["Albens centre", "Saint-Germain", "Cessens", "Saint-Girod"],
    localContext:
      "Albens, bourg de l'Albanais intégré depuis 2016 à la commune nouvelle d'Entrelacs, se trouve au nord du lac du Bourget, sur l'axe qui relie Aix-les-Bains à Annecy. Le bourg réunit commerces et écoles pour les villages voisins comme Saint-Germain-la-Chambotte, Cessens ou Saint-Girod. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service.",
    specialty: "agneau pour l'Aïd, méchoui, viande pour les grandes tablées familiales",
  },
  {
    slug: "yenne",
    name: "Yenne",
    description:
      "Boucherie halal à Yenne et dans l'Avant-Pays savoyard : avec Klik&Go, la viande se commande à l'avance, se retire au créneau choisi et se paie en boutique.",
    latitude: 45.7044,
    longitude: 5.7611,
    districts: ["Centre", "Lépin-le-Lac", "Saint-Paul", "Sainte-Marie"],
    localContext:
      "Yenne, bourg du Bugey savoyard au bord du Rhône, à l'ouest du Mont du Chat, fait partie de l'Avant-Pays savoyard. Le tunnel du Chat la relie au Bourget-du-Lac et à Chambéry, tandis que Belley, dans l'Ain, est toute proche de l'autre côté du Rhône. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi sur l'un de ces trajets et de la payer en boutique, sans frais de service, pour le quotidien comme pour un mariage.",
    specialty: "agneau, méchoui, viande pour les mariages et les grandes occasions familiales",
  },
  {
    slug: "montmelian",
    name: "Montmélian",
    description:
      "Boucherie halal à Montmélian, dans la combe de Savoie : Klik&Go permet de commander sa viande à l'avance et de la payer en boutique au retrait, sans frais.",
    latitude: 45.5008,
    longitude: 6.0497,
    districts: ["Centre", "La Combe", "Les Marches"],
    localContext:
      "Montmélian, au bord de l'Isère dans la combe de Savoie, se trouve à l'est de Chambéry, au carrefour des vallées qui mènent vers Grenoble, Albertville et la Maurienne. Ancienne place forte des ducs de Savoie, la ville est entourée de coteaux de vignes, d'Arbin à Cruet. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi sur le trajet du travail et de la payer en boutique, sans frais de service.",
    specialty: "agneau, bœuf pour les plats mijotés, volailles",
  },
  {
    slug: "pont-de-beauvoisin",
    name: "Pont-de-Beauvoisin",
    description:
      "Boucherie halal à Pont-de-Beauvoisin, de part et d'autre du Guiers : sur Klik&Go, commande à l'avance, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.5358,
    longitude: 5.6731,
    districts: ["Centre", "Saint-Béron", "Verel-de-Montbel"],
    localContext:
      "Pont-de-Beauvoisin est une ville double : la commune savoyarde fait face à sa voisine iséroise de part et d'autre du Guiers, rivière qui marqua longtemps la frontière entre la Savoie et la France. Porte de l'Avant-Pays savoyard, elle se trouve entre Chambéry, Voiron et le lac d'Aiguebelette. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, kefta, volailles",
  },
  {
    slug: "albertville",
    name: "Albertville",
    description:
      "Boucherie halal à Albertville, de Conflans au centre-ville : avec Klik&Go, la viande se commande à l'avance et se retire au créneau choisi, payée en boutique.",
    latitude: 45.6764,
    longitude: 6.3925,
    districts: ["Centre", "Conflans", "Saint-Sigismond"],
    localContext:
      "Albertville, sous-préfecture de la Savoie et ville hôte des Jeux olympiques d'hiver de 1992, s'étend au confluent de l'Isère et de l'Arly, aux portes de la Tarentaise et du Beaufortain. La cité médiévale de Conflans domine le centre-ville et la vallée. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi, en semaine comme avant un départ en montagne, et de la payer en boutique, sans frais de service.",
    specialty: "agneau, viande à griller, bœuf pour les plats mijotés",
  },
  {
    slug: "saint-jean-de-maurienne",
    name: "Saint-Jean-de-Maurienne",
    description:
      "Boucherie halal à Saint-Jean-de-Maurienne, en vallée de la Maurienne : commande à l'avance sur Klik&Go, retrait au créneau choisi, paiement en boutique.",
    latitude: 45.2767,
    longitude: 6.3489,
    districts: ["Centre", "Saint-Julien", "Le Pré"],
    localContext:
      "Saint-Jean-de-Maurienne, sous-préfecture de la Savoie, est la ville-centre de la vallée de la Maurienne, sur l'Arc, le long de l'A43 qui mène au tunnel du Fréjus et à l'Italie. Sa cathédrale Saint-Jean-Baptiste et le musée Opinel font partie de son patrimoine. Commander sa viande halal à l'avance sur Klik&Go permet de la retirer au créneau choisi et de la payer en boutique, sans frais de service, pour le quotidien comme pour le Ramadan et l'Aïd.",
    specialty: "agneau, viande pour les plats mijotés, brochettes",
  },
];
