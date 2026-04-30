export type SeoCity = {
  slug: string;
  name: string;
  region: string;
  description: string;
  latitude: number;
  longitude: number;
  /** Quartiers / villes desservis (linking opportunity + local relevance) */
  districts: readonly string[];
  /** Petit paragraphe de contexte local (≥120 mots) pour étoffer la page SEO */
  localContext: string;
  /** Spécialités viande typiques de la région (couscous merguez, mâchon lyonnais, etc.) */
  specialty: string;
};

export const SEO_CITIES: readonly SeoCity[] = [
  {
    slug: "chambery",
    name: "Chambéry",
    region: "Savoie",
    description:
      "Découvrez les boucheries halal de Chambéry et commandez en click & collect. Viande fraîche halal, retrait rapide en boutique dans toute la Savoie.",
    latitude: 45.5646,
    longitude: 5.9178,
    districts: ["Bissy", "Cognin", "La Motte-Servolex", "Centre-ville", "Chambéry-le-Haut"],
    localContext:
      "Chambéry, préfecture de la Savoie, compte une communauté musulmane active aux abords du centre-ville et dans les quartiers de Chambéry-le-Haut, Bissy et Cognin. Les boucheries halal de Chambéry approvisionnent les familles savoyardes en viande fraîche certifiée pour le quotidien comme pour les fêtes de l'Aïd, du Ramadan et des mariages. Avec Klik&Go, plus besoin de faire la queue le samedi matin : commandez en quelques minutes, payez en ligne ou sur place, et récupérez votre viande au créneau choisi. Les bouchers partenaires sélectionnent leurs élevages avec soin — agneaux savoyards, bœuf des Alpes, volailles fermières — pour vous offrir une viande de proximité, halal et traçable, à des prix justes.",
    specialty: "agneau de Savoie, gigot pour tajine, brochettes pour grillade au lac du Bourget",
  },
  {
    slug: "aix-les-bains",
    name: "Aix-les-Bains",
    region: "Savoie",
    description:
      "Commandez votre viande halal en ligne à Aix-les-Bains. Boucheries halal partenaires en Savoie, retrait en boutique rapide et pratique.",
    latitude: 45.6884,
    longitude: 5.9153,
    districts: ["Centre", "Mémard", "Sierroz", "Marlioz", "Choudy"],
    localContext:
      "Aix-les-Bains, station thermale au bord du lac du Bourget, attire chaque été curistes et visiteurs et compte une communauté musulmane installée de longue date. Les boucheries halal d'Aix-les-Bains approvisionnent les familles aixoises en viande fraîche halal, du quotidien aux grandes occasions. Klik&Go vous permet de commander en ligne en quelques minutes : choisissez votre boucher de quartier, sélectionnez vos pièces, payez en ligne ou sur place, et récupérez votre viande au créneau choisi. Idéal pour préparer un méchoui en famille ou des grillades sur les rives du lac sans perdre de temps. Pas de frais cachés, juste 0,99€ de service. La viande halal sélectionnée par les bouchers locaux d'Aix-les-Bains est issue d'élevages savoyards et alpins.",
    specialty: "agneau pour tajine, viande fraîche pour grillades au lac, volailles fermières",
  },
  {
    slug: "grenoble",
    name: "Grenoble",
    region: "Isère",
    description:
      "Commandez votre viande halal en ligne à Grenoble. Les meilleures boucheries halal de Grenoble et de l'agglomération grenobloise en click & collect.",
    latitude: 45.1885,
    longitude: 5.7245,
    districts: ["Villeneuve", "Mistral", "Teisseire", "Arlequin", "Saint-Bruno", "Echirolles"],
    localContext:
      "Grenoble, capitale des Alpes et 5e ville étudiante de France, abrite l'une des plus anciennes communautés musulmanes du sud-est. Les boucheries halal de Grenoble — Villeneuve, Mistral, Teisseire, Arlequin, Saint-Bruno et toute l'agglomération grenobloise jusqu'à Echirolles, Fontaine et Saint-Martin-d'Hères — approvisionnent les familles grenobloises en viande halal certifiée. Klik&Go simplifie votre achat : commandez en ligne depuis chez vous ou le bureau, choisissez le créneau de retrait qui vous arrange (matin avant le travail, midi, soir avant la fermeture), et récupérez votre commande sans attendre. Pratique pour le Ramadan, l'Aïd al-Fitr et l'Aïd al-Adha, mais aussi pour le repas du quotidien. Frais de service : 0,99€ par commande, sans surcoût caché.",
    specialty: "agneau, viande hachée pour kefta, volailles, brochettes",
  },
  {
    slug: "lyon",
    name: "Lyon",
    region: "Rhône",
    description:
      "Boucheries halal à Lyon : commandez en ligne et récupérez en boutique. Click & collect dans tout le Grand Lyon, Villeurbanne, Vénissieux, Vaulx-en-Velin.",
    latitude: 45.764,
    longitude: 4.8357,
    districts: ["La Guillotière", "Vaise", "Croix-Rousse", "Gerland", "Villeurbanne", "Vénissieux", "Vaulx-en-Velin", "Bron"],
    localContext:
      "Lyon, métropole de plus d'un million d'habitants, possède l'une des plus grandes communautés musulmanes de France après Paris et Marseille. Le Grand Lyon — La Guillotière, Vaise, Gerland, mais aussi Villeurbanne, Vénissieux, Vaulx-en-Velin et Bron — concentre des dizaines de boucheries halal de quartier, héritières d'une tradition d'accueil et de mixité culinaire qui fait la richesse de la gastronomie lyonnaise. Les boucheries halal partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs locaux du Beaujolais, du Bugey et du Sud-Lyonnais : agneau, bœuf charolais, volailles fermières des Dombes. Commandez en ligne depuis votre canapé, payez en quelques clics et récupérez votre viande au créneau de votre choix. Plus besoin de chercher une place de parking sur le cours Gambetta ou avenue Berthelot. Pratique pour les grandes commandes du Ramadan ou de l'Aïd, comme pour la viande quotidienne.",
    specialty: "couscous-merguez, viande pour mâchon, agneau, volailles des Dombes",
  },
  {
    slug: "saint-etienne",
    name: "Saint-Étienne",
    region: "Loire",
    description:
      "Trouvez votre boucherie halal à Saint-Étienne. Commande en ligne, retrait en boutique. Viande halal fraîche et de qualité dans la Loire.",
    latitude: 45.4397,
    longitude: 4.3872,
    districts: ["Bellevue", "Tarentaize", "Beaubrun", "Le Crêt-de-Roc", "Montreynaud", "Centre-Deux"],
    localContext:
      "Saint-Étienne, capitale de la Loire et ancienne capitale du design, compte une communauté musulmane historiquement présente depuis les vagues d'immigration ouvrière du XXe siècle. Les boucheries halal de Saint-Étienne — Bellevue, Tarentaize, Beaubrun, Crêt-de-Roc, Montreynaud — proposent une viande halal certifiée issue principalement d'élevages du Forez et du Pilat. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la en boutique au créneau qui vous convient : pratique pour les familles, les étudiants des deux universités stéphanoises, et tous ceux qui veulent gagner du temps sans sacrifier la qualité. Pas de frais d'abonnement, juste 0,99€ de frais de service par commande.",
    specialty: "agneau du Pilat, bœuf charolais, viande pour grillades",
  },
  {
    slug: "annecy",
    name: "Annecy",
    region: "Haute-Savoie",
    description:
      "Boucheries halal à Annecy et en Haute-Savoie. Commandez en ligne et récupérez votre viande halal fraîche en boutique.",
    latitude: 45.8992,
    longitude: 6.1294,
    districts: ["Annecy-le-Vieux", "Cran-Gevrier", "Seynod", "Meythet", "Pringy"],
    localContext:
      "Annecy, surnommée \"la Venise des Alpes\" pour ses canaux et son lac, est l'une des villes les plus dynamiques de France. La communauté musulmane y est en croissance, notamment dans les quartiers de Cran-Gevrier, Seynod et Meythet. Les boucheries halal annéciennes proposent une viande halal locale issue d'élevages haut-savoyards : agneaux, bœuf, volailles fermières. Klik&Go vous évite la file d'attente du samedi matin sur les rives du lac : commandez quand vous voulez, payez en ligne ou sur place, et récupérez votre commande au moment qui vous arrange. Idéal pour préparer un barbecue d'été au bord du lac d'Annecy, un méchoui pour l'Aïd, ou simplement pour gagner 30 minutes sur la pause déjeuner.",
    specialty: "agneau de Haute-Savoie, viande pour grillades au lac, volailles fermières",
  },
  {
    slug: "cognin",
    name: "Cognin",
    region: "Savoie",
    description:
      "Boucheries halal à Cognin (Savoie). Commandez votre viande halal en ligne et récupérez-la en boutique en click & collect, à 5 minutes du centre de Chambéry.",
    latitude: 45.5599,
    longitude: 5.8861,
    districts: ["Centre Cognin", "Beauvoir", "Plainpalais"],
    localContext:
      "Cognin, commune de l'agglomération chambérienne située au pied du massif de la Chartreuse, compte plus de 6 000 habitants et accueille plusieurs boucheries de proximité dont des boucheries halal certifiées. À 5 minutes en voiture du centre de Chambéry, Cognin est un quartier résidentiel apprécié pour sa tranquillité et sa proximité avec les commodités. Les familles cogninoises et chambériennes y trouvent leur viande halal fraîche, sélectionnée par des bouchers passionnés qui travaillent avec des éleveurs savoyards. Klik&Go simplifie l'achat : commandez en ligne, payez en ligne ou sur place, récupérez en quelques minutes au créneau choisi. Pas de file d'attente, pas de stress, et seulement 0,99€ de frais de service par commande.",
    specialty: "agneau de Savoie, viande pour tajine et grillades, volailles fermières",
  },
  {
    slug: "bissy",
    name: "Bissy",
    region: "Savoie",
    description:
      "Boucheries halal à Bissy (Chambéry). Trouvez votre boucher halal à Bissy et commandez en click & collect : viande halal fraîche, retrait rapide.",
    latitude: 45.5742,
    longitude: 5.8867,
    districts: ["Zone industrielle Bissy", "Bissy-village"],
    localContext:
      "Bissy, quartier ouest de Chambéry à proximité directe de la gare et de l'autoroute A43, est connu pour sa zone d'activité dynamique et son tissu commercial. Plusieurs boucheries halal y sont implantées et servent les familles chambériennes ainsi que les actifs travaillant dans les entreprises de la zone. Avec Klik&Go, vous commandez votre viande halal pendant la pause déjeuner et la récupérez en sortant du travail — sans perdre de temps. Les bouchers de Bissy sélectionnent leurs viandes auprès d'éleveurs des Bauges, de la Chartreuse et du bassin chambérien : agneau, bœuf, volailles. Frais de service : 0,99€ par commande, pas d'abonnement, pas de surprise.",
    specialty: "viande pour grillades rapides, brochettes, hachis halal pour repas du midi",
  },
  {
    slug: "la-motte-servolex",
    name: "La Motte-Servolex",
    region: "Savoie",
    description:
      "Boucheries halal à La Motte-Servolex. Commandez votre viande halal en ligne avec retrait en boutique près de Chambéry.",
    latitude: 45.5933,
    longitude: 5.8761,
    districts: ["Centre", "Reignier", "Belledonne"],
    localContext:
      "La Motte-Servolex, troisième commune de Savoie avec plus de 13 000 habitants, jouxte Chambéry et bénéficie de son dynamisme tout en conservant une identité de bourg paisible. Les boucheries halal y sont prisées par les familles motterannes et chambériennes pour la qualité de leur viande et la proximité avec les éleveurs locaux des Bauges. Klik&Go vous permet de commander à distance et de récupérer votre commande sans attente, idéal quand vous rentrez du travail ou pour préparer un repas familial le week-end. Pas d'abonnement caché, juste 0,99€ de frais de service.",
    specialty: "agneau, bœuf des Bauges, volailles fermières",
  },
  {
    slug: "villeurbanne",
    name: "Villeurbanne",
    region: "Rhône",
    description:
      "Boucheries halal à Villeurbanne. Commande en ligne et retrait en boutique pour votre viande halal fraîche dans le Grand Lyon.",
    latitude: 45.7665,
    longitude: 4.8795,
    districts: ["Gratte-Ciel", "Tonkin", "Cusset", "Charpennes", "La Ferrandière"],
    localContext:
      "Villeurbanne, deuxième ville du Grand Lyon avec plus de 150 000 habitants, abrite une communauté musulmane dense, notamment dans les quartiers de Cusset, Tonkin, La Ferrandière et autour des Gratte-Ciel. Les boucheries halal villeurbannaises proposent une viande halal certifiée issue d'élevages du Beaujolais et du Sud-Lyonnais : agneau, bœuf, volailles. Klik&Go vous fait gagner du temps : commandez en ligne, choisissez votre créneau de retrait, payez en ligne ou sur place, et récupérez votre viande sans file d'attente. Idéal pour les familles villeurbannaises actives et les étudiants de l'INSA et de l'Université Lyon 1. Frais de service : 0,99€ par commande.",
    specialty: "couscous-merguez, viande pour kefta, agneau, volailles des Dombes",
  },
  {
    slug: "venissieux",
    name: "Vénissieux",
    region: "Rhône",
    description:
      "Boucheries halal à Vénissieux. Commandez votre viande halal en click & collect et récupérez-la en boutique dans la métropole lyonnaise.",
    latitude: 45.6975,
    longitude: 4.8867,
    districts: ["Les Minguettes", "Centre-ville", "Parilly", "Moulin-à-Vent"],
    localContext:
      "Vénissieux, dans le Sud-Est lyonnais, compte plus de 65 000 habitants et abrite une importante communauté musulmane historiquement implantée dans les quartiers des Minguettes, du centre-ville et de Parilly. Les boucheries halal vénissianes sont parmi les plus actives du Grand Lyon et proposent une viande halal certifiée à des prix compétitifs. Klik&Go simplifie votre achat : commandez en ligne pour la viande quotidienne, l'Aïd ou un grand repas familial. Vous payez en ligne ou sur place, vous récupérez votre commande au créneau choisi sans attendre. Frais de service : 0,99€ par commande, pas d'abonnement, pas de commission cachée. Les bouchers partenaires sélectionnent leurs viandes auprès d'éleveurs de la Loire et du Beaujolais.",
    specialty: "agneau, bœuf charolais, viande hachée halal pour merguez maison",
  },
] as const;
