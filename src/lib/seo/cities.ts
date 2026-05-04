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
    districts: [
      "Bellevue",
      "Tarentaize",
      "Beaubrun",
      "Le Crêt-de-Roc",
      "Montreynaud",
      "Centre-Deux",
    ],
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
  // ── Extensions SEO Sprint 1 (mai 2026) — couverture Rhône-Alpes ──
  {
    slug: "vaulx-en-velin",
    name: "Vaulx-en-Velin",
    region: "Rhône",
    description:
      "Boucheries halal à Vaulx-en-Velin. Commandez votre viande halal en click & collect dans le Grand Lyon, retrait rapide en boutique.",
    latitude: 45.7779,
    longitude: 4.9201,
    districts: ["Mas du Taureau", "Centre-ville", "La Soie", "Grand Vire"],
    localContext:
      "Vaulx-en-Velin, ville de l'est lyonnais avec plus de 50 000 habitants, abrite une grande communauté musulmane et plusieurs boucheries halal certifiées dans les quartiers du Mas du Taureau, du centre-ville et autour de la Grande Mosquée. Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs du Beaujolais et de l'Isle d'Abeau : agneau, bœuf charolais, volailles fermières des Dombes. Commandez en ligne pour la viande quotidienne, l'Aïd ou un grand repas familial. Pas de file d'attente, payez en ligne ou sur place, récupérez votre viande au créneau choisi. Frais de service : 0,99€ par commande.",
    specialty: "agneau, viande pour kefta, brochettes, bœuf charolais",
  },
  {
    slug: "bron",
    name: "Bron",
    region: "Rhône",
    description:
      "Boucheries halal à Bron. Click & collect halal dans la banlieue est de Lyon, retrait rapide pour votre viande halal fraîche.",
    latitude: 45.7361,
    longitude: 4.9128,
    districts: ["Centre-ville", "Parilly", "Terraillon", "Les Essarts"],
    localContext:
      "Bron, commune de la première couronne lyonnaise (40 000 habitants), accueille plusieurs boucheries halal de proximité, notamment dans les quartiers du Terraillon et autour du parc de Parilly. Les boucheries halal bronoises proposent une viande halal certifiée pour les familles de Bron, Saint-Priest et Chassieu. Klik&Go vous simplifie la vie : commandez votre viande en ligne, choisissez votre créneau, récupérez en boutique sans attendre. Idéal pour la pause déjeuner ou en sortant du travail. Frais de service : 0,99€ par commande, pas d'abonnement.",
    specialty: "agneau, viande hachée halal, brochettes, escalopes de poulet",
  },
  {
    slug: "saint-priest",
    name: "Saint-Priest",
    region: "Rhône",
    description:
      "Boucheries halal à Saint-Priest. Commandez en ligne et récupérez votre viande halal en click & collect dans l'est lyonnais.",
    latitude: 45.6968,
    longitude: 4.9408,
    districts: ["Centre-ville", "Bel-Air", "Manissieux", "Revaison"],
    localContext:
      "Saint-Priest, troisième commune du Grand Lyon avec 47 000 habitants, compte une communauté musulmane installée dans les quartiers de Bel-Air et du centre-ville. Les boucheries halal de Saint-Priest sélectionnent leurs viandes auprès d'éleveurs du Sud-Lyonnais et du Beaujolais. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la en quelques minutes au créneau choisi. Pratique pour les familles san-priodes et pour les actifs travaillant dans les zones d'activité environnantes. Frais de service : 0,99€ par commande.",
    specialty: "viande pour grillades, agneau, bœuf charolais, kefta halal",
  },
  {
    slug: "meyzieu",
    name: "Meyzieu",
    region: "Rhône",
    description:
      "Boucheries halal à Meyzieu. Click & collect halal dans l'est de Lyon, retrait rapide en boutique pour votre viande halal fraîche.",
    latitude: 45.7681,
    longitude: 5.0028,
    districts: ["Centre-ville", "Plan d'Eau", "Mathiolan"],
    localContext:
      "Meyzieu, commune de l'Est lyonnais (33 000 habitants), accueille plusieurs boucheries halal de proximité dans son centre-ville et le long de la zone commerciale. Les bouchers partenaires Klik&Go proposent une viande halal certifiée issue d'élevages du Bugey et du Sud-Lyonnais. Klik&Go vous fait gagner du temps : commandez en ligne, payez en ligne ou sur place, récupérez votre commande sans file d'attente au créneau choisi. Frais de service : 0,99€ par commande, pas d'abonnement.",
    specialty: "agneau, brochettes pour barbecue, viande hachée halal, volailles",
  },
  {
    slug: "rillieux-la-pape",
    name: "Rillieux-la-Pape",
    region: "Rhône",
    description:
      "Boucheries halal à Rillieux-la-Pape. Commandez en ligne et récupérez votre viande halal au nord de Lyon.",
    latitude: 45.8181,
    longitude: 4.8983,
    districts: ["Ville Nouvelle", "Crépieux", "Vancia", "Le Loup Pendu"],
    localContext:
      "Rillieux-la-Pape, commune du nord-est lyonnais (30 000 habitants), abrite une communauté musulmane active dans les quartiers de la Ville Nouvelle et de Crépieux. Les boucheries halal rilliardes proposent une viande halal certifiée pour les familles du nord du Grand Lyon. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la au créneau choisi sans perdre de temps. Frais de service : 0,99€ par commande.",
    specialty: "agneau, viande pour mijoté, bœuf charolais, volailles fermières",
  },
  {
    slug: "givors",
    name: "Givors",
    region: "Rhône",
    description:
      "Boucheries halal à Givors. Click & collect halal au sud de Lyon, retrait pratique en boutique pour votre viande fraîche.",
    latitude: 45.5856,
    longitude: 4.7689,
    districts: ["Centre-ville", "Vernes", "Bans"],
    localContext:
      "Givors, ville du sud du Rhône (19 000 habitants), à la confluence du Rhône et du Gier, compte plusieurs boucheries halal historiquement implantées dans le centre-ville et le quartier des Vernes. Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs locaux du Pilat et du Beaujolais. Commandez en ligne, payez en ligne ou sur place, récupérez votre viande au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau du Pilat, viande pour grillades, bœuf charolais",
  },
  {
    slug: "oullins",
    name: "Oullins",
    region: "Rhône",
    description:
      "Boucheries halal à Oullins. Click & collect halal dans le sud-ouest lyonnais, retrait rapide en boutique.",
    latitude: 45.7144,
    longitude: 4.8086,
    districts: ["Centre", "La Saulaie", "Pierre-Bénite"],
    localContext:
      "Oullins, commune du sud-ouest lyonnais (26 000 habitants) traversée par le Rhône, accueille plusieurs boucheries halal de quartier. Les boucheries halal oullinoises proposent une viande halal certifiée pour les familles du sud-ouest du Grand Lyon. Klik&Go vous évite les files d'attente : commandez en ligne et récupérez votre commande à votre créneau. Frais de service : 0,99€ par commande.",
    specialty: "agneau, brochettes, viande hachée halal, volailles",
  },
  {
    slug: "decines-charpieu",
    name: "Décines-Charpieu",
    region: "Rhône",
    description:
      "Boucheries halal à Décines-Charpieu. Commandez en ligne votre viande halal et récupérez-la en click & collect dans l'est lyonnais.",
    latitude: 45.7706,
    longitude: 4.9586,
    districts: ["Centre", "Le Sept-Chemins", "La Mouche"],
    localContext:
      "Décines-Charpieu, commune de l'est lyonnais (28 000 habitants), abrite plusieurs boucheries halal certifiées qui servent les familles décinoises et des communes voisines (Meyzieu, Chassieu). Avec Klik&Go, commandez votre viande halal en ligne pour la viande quotidienne ou les grands repas familiaux. Frais de service : 0,99€ par commande, pas d'abonnement.",
    specialty: "agneau, viande pour kefta, brochettes, bœuf charolais",
  },
  // ── Isère ──
  {
    slug: "echirolles",
    name: "Échirolles",
    region: "Isère",
    description:
      "Boucheries halal à Échirolles. Click & collect halal en banlieue de Grenoble, retrait rapide en boutique.",
    latitude: 45.1467,
    longitude: 5.7142,
    districts: ["Village 2", "La Luire", "Essarts", "Centre"],
    localContext:
      "Échirolles, deuxième commune de l'Isère (37 000 habitants), accueille une importante communauté musulmane et plusieurs boucheries halal certifiées dans les quartiers de la Luire et du Village 2. Les bouchers partenaires Klik&Go proposent une viande halal certifiée issue d'élevages alpins. Commandez en ligne, payez en ligne ou sur place, récupérez en quelques minutes au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau, viande pour tajine, brochettes, volailles fermières",
  },
  {
    slug: "saint-martin-dheres",
    name: "Saint-Martin-d'Hères",
    region: "Isère",
    description:
      "Boucheries halal à Saint-Martin-d'Hères. Commandez votre viande halal en ligne et récupérez en click & collect dans la banlieue de Grenoble.",
    latitude: 45.1729,
    longitude: 5.7575,
    districts: ["Champberton", "Galochère", "Renaudie", "Université"],
    localContext:
      "Saint-Martin-d'Hères, troisième ville de l'Isère (38 000 habitants), abrite l'Université Grenoble Alpes et une importante communauté musulmane. Les boucheries halal san-martinoises proposent une viande halal certifiée pour les familles, les étudiants et les personnels universitaires. Klik&Go simplifie votre achat : commandez en ligne, récupérez sans attendre. Frais de service : 0,99€ par commande.",
    specialty: "agneau, viande hachée halal, escalopes poulet, brochettes",
  },
  {
    slug: "fontaine",
    name: "Fontaine",
    region: "Isère",
    description:
      "Boucheries halal à Fontaine. Click & collect halal à Grenoble Ouest, retrait rapide pour votre viande halal fraîche.",
    latitude: 45.1944,
    longitude: 5.685,
    districts: ["Centre", "Bastille", "Bouvignier"],
    localContext:
      "Fontaine, commune de l'agglomération grenobloise (23 000 habitants), accueille plusieurs boucheries halal qui servent les familles de Fontaine, Sassenage et des communes voisines. Klik&Go vous fait gagner du temps : commandez en ligne et récupérez votre commande au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau alpin, viande pour grillades, volailles fermières",
  },
  {
    slug: "voiron",
    name: "Voiron",
    region: "Isère",
    description:
      "Boucheries halal à Voiron. Click & collect halal au nord de Grenoble, dans le pays voironnais.",
    latitude: 45.3654,
    longitude: 5.5901,
    districts: ["Centre", "Brunetière", "Sermorens"],
    localContext:
      "Voiron, sous-préfecture de l'Isère (20 000 habitants) à 25 km au nord de Grenoble, accueille plusieurs boucheries halal de proximité dans son centre historique. Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs des Bauges et de la Chartreuse. Commandez en ligne, récupérez votre commande sans attente. Frais de service : 0,99€.",
    specialty: "agneau, viande pour mijoté, bœuf charolais, volailles",
  },
  {
    slug: "bourgoin-jallieu",
    name: "Bourgoin-Jallieu",
    region: "Isère",
    description:
      "Boucheries halal à Bourgoin-Jallieu. Commandez votre viande halal en ligne et récupérez en click & collect dans le Nord-Isère.",
    latitude: 45.5859,
    longitude: 5.2725,
    districts: ["Centre", "Champaret", "Champ Fleuri", "Pré Bénit"],
    localContext:
      "Bourgoin-Jallieu, sous-préfecture de l'Isère (28 000 habitants) sur l'axe Lyon-Grenoble, accueille plusieurs boucheries halal qui servent les familles berjalliennes et des communes voisines. Klik&Go vous simplifie la vie : commandez en ligne, payez en ligne ou sur place, récupérez votre viande au créneau choisi. Frais de service : 0,99€ par commande.",
    specialty: "agneau, viande pour grillades, bœuf charolais, volailles",
  },
  {
    slug: "vienne",
    name: "Vienne",
    region: "Isère",
    description:
      "Boucheries halal à Vienne. Click & collect halal au sud de Lyon, dans le département de l'Isère.",
    latitude: 45.524,
    longitude: 4.8744,
    districts: ["Centre", "Estressin", "Malissol"],
    localContext:
      "Vienne, sous-préfecture de l'Isère (29 000 habitants) sur les bords du Rhône, abrite plusieurs boucheries halal certifiées qui servent les familles viennoises et l'agglomération de Vienne Condrieu. Klik&Go simplifie votre achat : commandez en ligne, récupérez sans attendre au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau, viande pour grillades, brochettes, bœuf",
  },
  // ── Loire ──
  {
    slug: "roanne",
    name: "Roanne",
    region: "Loire",
    description:
      "Boucheries halal à Roanne. Click & collect halal au nord de la Loire, retrait rapide pour votre viande halal fraîche.",
    latitude: 46.0367,
    longitude: 4.0689,
    districts: ["Centre", "Mâtel", "Le Bourg"],
    localContext:
      "Roanne, sous-préfecture de la Loire (35 000 habitants) au cœur de la plaine roannaise, accueille plusieurs boucheries halal qui servent les familles roannaises et l'agglomération. Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs du Forez et du Beaujolais. Commandez en ligne, payez en ligne ou sur place, récupérez votre viande au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau, bœuf charolais, viande pour grillades",
  },
  {
    slug: "firminy",
    name: "Firminy",
    region: "Loire",
    description:
      "Boucheries halal à Firminy. Commandez votre viande halal en ligne et récupérez en click & collect dans la vallée de l'Ondaine.",
    latitude: 45.3878,
    longitude: 4.2867,
    districts: ["Centre", "Le Chambon-Feugerolles", "Vert-Bois"],
    localContext:
      "Firminy, commune de la vallée de l'Ondaine (16 000 habitants) au sud de Saint-Étienne, abrite une communauté musulmane historique et plusieurs boucheries halal de quartier. Les boucheries halal firminoises proposent une viande halal certifiée issue d'élevages du Forez et du Pilat. Avec Klik&Go, commandez en ligne et récupérez sans attente. Frais de service : 0,99€ par commande.",
    specialty: "agneau du Pilat, viande pour mijoté, brochettes",
  },
  // ── Haute-Savoie ──
  {
    slug: "annemasse",
    name: "Annemasse",
    region: "Haute-Savoie",
    description:
      "Boucheries halal à Annemasse. Click & collect halal en Haute-Savoie, à proximité de la frontière suisse.",
    latitude: 46.1934,
    longitude: 6.2349,
    districts: ["Centre", "Vétraz-Monthoux", "Romagny"],
    localContext:
      "Annemasse, commune de Haute-Savoie (35 000 habitants) à la frontière suisse, accueille plusieurs boucheries halal certifiées dans le centre-ville et autour de la gare. Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs haut-savoyards et de l'Ain. Commandez en ligne, récupérez sans attendre. Frais de service : 0,99€.",
    specialty: "agneau, bœuf, viande pour grillades, volailles fermières",
  },
  {
    slug: "thonon-les-bains",
    name: "Thonon-les-Bains",
    region: "Haute-Savoie",
    description:
      "Boucheries halal à Thonon-les-Bains. Commandez en ligne votre viande halal et récupérez en click & collect au bord du lac Léman.",
    latitude: 46.3719,
    longitude: 6.4781,
    districts: ["Centre", "Châtelard", "Concise"],
    localContext:
      "Thonon-les-Bains, sous-préfecture de Haute-Savoie (35 000 habitants) sur les rives du lac Léman, accueille plusieurs boucheries halal qui servent les familles thononaises. Les boucheries halal thononaises proposent une viande halal certifiée issue d'élevages du Chablais. Avec Klik&Go, commandez votre viande en ligne et récupérez-la sans file d'attente. Frais de service : 0,99€.",
    specialty: "agneau du Chablais, viande pour grillades au lac, volailles fermières",
  },
  {
    slug: "cluses",
    name: "Cluses",
    region: "Haute-Savoie",
    description:
      "Boucheries halal à Cluses. Click & collect halal dans la vallée de l'Arve, retrait rapide pour votre viande halal fraîche.",
    latitude: 46.0628,
    longitude: 6.5825,
    districts: ["Centre", "Sardagne", "Saint-Vincent"],
    localContext:
      "Cluses, commune de Haute-Savoie (18 000 habitants) au cœur de la vallée de l'Arve, accueille plusieurs boucheries halal qui servent les familles clusiennes et l'agglomération de la vallée de l'Arve (Marnaz, Scionzier, Magland). Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs des Aravis et du Faucigny. Frais de service : 0,99€.",
    specialty: "agneau des Aravis, viande pour grillades, bœuf",
  },
  // ── Savoie ──
  {
    slug: "albertville",
    name: "Albertville",
    region: "Savoie",
    description:
      "Boucheries halal à Albertville. Commandez en ligne votre viande halal et récupérez en click & collect en Tarentaise.",
    latitude: 45.6764,
    longitude: 6.3925,
    districts: ["Centre", "Conflans", "Saint-Sigismond"],
    localContext:
      "Albertville, sous-préfecture de Savoie (19 000 habitants) en Tarentaise (ville olympique 1992), accueille plusieurs boucheries halal qui servent les familles albertvilloises et l'agglomération du Beaufortain. Les boucheries halal albertvilloises proposent une viande halal certifiée issue d'élevages savoyards. Avec Klik&Go, commandez en ligne et récupérez votre viande sans attendre. Frais de service : 0,99€.",
    specialty: "agneau de Tarentaise, viande pour grillades, bœuf des Bauges",
  },
  {
    slug: "saint-jean-de-maurienne",
    name: "Saint-Jean-de-Maurienne",
    region: "Savoie",
    description:
      "Boucheries halal à Saint-Jean-de-Maurienne. Click & collect halal en Maurienne, retrait rapide pour votre viande halal fraîche.",
    latitude: 45.2767,
    longitude: 6.3489,
    districts: ["Centre", "Saint-Julien", "Le Pré"],
    localContext:
      "Saint-Jean-de-Maurienne, sous-préfecture de Savoie (8 000 habitants) en vallée de Maurienne, accueille des boucheries halal qui servent les familles mauriennaises et l'agglomération de la vallée. Les bouchers partenaires Klik&Go sélectionnent leurs viandes auprès d'éleveurs alpins. Commandez en ligne et récupérez sans attendre au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau de Maurienne, viande pour mijoté, brochettes",
  },
  // ── Sprint 2 (mai 2026) — Cluse chambérienne et alentours immédiats ──
  // Demande user 2026-05-04 : prioriser les villes autour de Chambéry
  // qui ont déjà des boucheries halal. Ces communes sont à <15 min de
  // voiture de Chambéry, partagent la même clientèle, et représentent
  // collectivement +40 000 habitants supplémentaires en bassin SEO.
  {
    slug: "pont-de-beauvoisin",
    name: "Pont-de-Beauvoisin",
    region: "Savoie",
    description:
      "Boucheries halal à Pont-de-Beauvoisin. Click & collect halal entre Savoie et Isère, retrait rapide pour votre viande halal fraîche.",
    latitude: 45.5358,
    longitude: 5.6731,
    districts: ["Centre", "Saint-Béron", "Verel-de-Montbel"],
    localContext:
      "Pont-de-Beauvoisin, ville-frontière entre Savoie et Isère (3 500 habitants côté savoyard, 8 000 avec l'agglomération iséroise jumelle), est un carrefour historique entre Chambéry, Voiron et Lyon. La communauté musulmane locale s'approvisionne en viande halal dans les boucheries du centre-ville et des communes environnantes (Saint-Béron, Verel-de-Montbel, Domessin). Avec Klik&Go, plus besoin de faire 30 km jusqu'à Chambéry ou Voiron : commandez en ligne, payez en ligne ou sur place, et récupérez votre commande halal au créneau choisi. Idéal pour les familles ponti-beauvoisinoises et les actifs travaillant sur l'axe Chambéry-Lyon. Frais de service : 0,99€ par commande.",
    specialty: "agneau, viande pour grillades, kefta halal, volailles fermières",
  },
  {
    slug: "montmelian",
    name: "Montmélian",
    region: "Savoie",
    description:
      "Boucheries halal à Montmélian. Commandez en ligne et récupérez votre viande halal en click & collect dans la combe de Savoie.",
    latitude: 45.5008,
    longitude: 6.0497,
    districts: ["Centre", "La Combe", "Les Marches"],
    localContext:
      "Montmélian, commune de Savoie (4 500 habitants) à 15 km à l'est de Chambéry sur l'axe vers Albertville et la Tarentaise, accueille une communauté musulmane installée notamment autour de la zone d'activité et du centre historique. Les boucheries halal montmélianaises proposent une viande halal certifiée pour les familles de la combe de Savoie (Les Marches, Coise, Saint-Pierre-d'Albigny). Klik&Go vous permet de commander en ligne pendant la pause déjeuner et de récupérer votre viande en sortant du travail, sans détour par Chambéry. Frais de service : 0,99€ par commande, pas d'abonnement.",
    specialty: "agneau, viande pour mijoté savoyard, bœuf des Bauges, volailles",
  },
  {
    slug: "le-bourget-du-lac",
    name: "Le Bourget-du-Lac",
    region: "Savoie",
    description:
      "Boucheries halal au Bourget-du-Lac. Click & collect halal sur les rives du lac du Bourget, retrait rapide pour votre viande halal fraîche.",
    latitude: 45.6486,
    longitude: 5.8639,
    districts: ["Centre", "Bourdeau", "Le Tremblay"],
    localContext:
      "Le Bourget-du-Lac, commune de Savoie (10 000 habitants) sur la rive sud du lac du Bourget entre Chambéry et Aix-les-Bains, héberge le campus Savoie Technolac et une communauté musulmane mêlée d'étudiants, chercheurs et familles. Les boucheries halal du Bourget-du-Lac et des communes voisines (Drumettaz-Clarafond, Voglans) servent une clientèle exigeante et internationale. Klik&Go vous évite les bouchons d'été sur la rive du lac : commandez en ligne, récupérez à votre créneau, et profitez du lac. Idéal pour les barbecues du week-end et les fêtes de l'Aïd. Frais de service : 0,99€.",
    specialty: "viande pour grillades au lac, agneau, brochettes, volailles fermières",
  },
  {
    slug: "la-ravoire",
    name: "La Ravoire",
    region: "Savoie",
    description:
      "Boucheries halal à La Ravoire. Commandez votre viande halal en ligne et récupérez en click & collect en banlieue sud-est de Chambéry.",
    latitude: 45.5544,
    longitude: 5.9533,
    districts: ["Centre", "Vallon", "Mâche", "Féjaz"],
    localContext:
      "La Ravoire, deuxième commune de l'agglomération chambérienne (9 500 habitants), jouxte directement Chambéry au sud-est. La ville accueille une communauté musulmane active dans les quartiers de Vallon et de Mâche, et plusieurs boucheries halal certifiées y sont implantées. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la sans détour par le centre de Chambéry, idéal pour les familles ravoiriennes et les actifs des zones d'activité environnantes. Frais de service : 0,99€ par commande, pas d'abonnement, pas de surprise.",
    specialty: "agneau, viande pour kefta, brochettes, volailles fermières",
  },
  {
    slug: "challes-les-eaux",
    name: "Challes-les-Eaux",
    region: "Savoie",
    description:
      "Boucheries halal à Challes-les-Eaux. Click & collect halal au sud de Chambéry, retrait rapide pour votre viande halal fraîche.",
    latitude: 45.545,
    longitude: 5.9764,
    districts: ["Centre", "Triviers", "Villaret"],
    localContext:
      "Challes-les-Eaux, commune thermale de Savoie (5 500 habitants) au sud immédiat de Chambéry, accueille curistes et familles toute l'année. La proximité avec Chambéry et La Ravoire fait que les boucheries halal de la zone servent une clientèle élargie aux communes du Saint-Cassin, Saint-Jeoire-Prieuré et Sonnaz. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la au créneau choisi. Frais de service : 0,99€ par commande.",
    specialty: "agneau de Chartreuse, viande pour grillades, volailles, brochettes",
  },
  {
    slug: "saint-alban-leysse",
    name: "Saint-Alban-Leysse",
    region: "Savoie",
    description:
      "Boucheries halal à Saint-Alban-Leysse. Commandez en ligne et récupérez votre viande halal en click & collect en banlieue nord-est de Chambéry.",
    latitude: 45.5806,
    longitude: 5.9522,
    districts: ["Centre", "Plainpalais", "Croix-Rouge"],
    localContext:
      "Saint-Alban-Leysse, commune de l'agglomération chambérienne (6 000 habitants) au pied du massif des Bauges, est une porte d'entrée naturelle pour les randonneurs et une zone résidentielle prisée des familles chambériennes. Les boucheries halal de Saint-Alban et des communes voisines (Bassens, Verel-Pragondran) proposent une viande halal certifiée issue d'élevages des Bauges. Klik&Go vous fait gagner du temps : commandez en ligne, récupérez sans attendre au créneau choisi. Frais de service : 0,99€ par commande.",
    specialty: "agneau des Bauges, bœuf alpin, viande pour mijoté, brochettes",
  },
  {
    slug: "barberaz",
    name: "Barberaz",
    region: "Savoie",
    description:
      "Boucheries halal à Barberaz. Click & collect halal en banlieue sud de Chambéry, retrait rapide en boutique.",
    latitude: 45.5631,
    longitude: 5.9489,
    districts: ["Centre", "Pré Hibou", "Mérande"],
    localContext:
      "Barberaz, commune de l'agglomération chambérienne (5 000 habitants) au sud immédiat de Chambéry, entre La Ravoire et Saint-Alban-Leysse, accueille une communauté musulmane installée de longue date. Les boucheries halal de Barberaz servent les familles barberalines et celles des communes voisines (Cognin, Chambéry-le-Haut). Klik&Go simplifie votre achat : commandez en ligne, payez en ligne ou sur place, récupérez votre viande au créneau choisi. Frais de service : 0,99€.",
    specialty: "agneau, viande pour kefta, brochettes halal, volailles",
  },
  {
    slug: "jacob-bellecombette",
    name: "Jacob-Bellecombette",
    region: "Savoie",
    description:
      "Boucheries halal à Jacob-Bellecombette. Commandez votre viande halal en click & collect en banlieue ouest de Chambéry.",
    latitude: 45.5519,
    longitude: 5.9097,
    districts: ["Jacob", "Bellecombette", "Le Tremblay"],
    localContext:
      "Jacob-Bellecombette, commune résidentielle de l'agglomération chambérienne (3 500 habitants) au sud-ouest de Chambéry, abrite une partie de l'Université Savoie Mont Blanc et une population mélangée d'étudiants, enseignants et familles. Les boucheries halal de la zone (Jacob, Cognin, Chambéry sud) servent une clientèle régulière. Avec Klik&Go, commandez votre viande halal en ligne et récupérez-la au créneau choisi. Frais de service : 0,99€ par commande.",
    specialty: "agneau, viande pour grillades, brochettes, volailles fermières",
  },
] as const;

/**
 * Métadonnées départementales pour la création des hub pages /boucheries-halal/[departement].
 * Sprint 1 (mai 2026) — pivot annuaire local.
 */
export type SeoDepartment = {
  slug: string;
  name: string;
  region: string;
  /** Slugs de villes (depuis SEO_CITIES) qui appartiennent à ce département */
  citySlugs: readonly string[];
  description: string;
  /** Contexte régional pour la page hub (≥250 mots) */
  context: string;
};

export const SEO_DEPARTMENTS: readonly SeoDepartment[] = [
  {
    slug: "savoie",
    name: "Savoie",
    region: "Auvergne-Rhône-Alpes",
    citySlugs: [
      "chambery",
      "aix-les-bains",
      "cognin",
      "bissy",
      "la-motte-servolex",
      "albertville",
      "saint-jean-de-maurienne",
      // Sprint 2 (mai 2026) — cluse chambérienne et alentours immédiats
      "pont-de-beauvoisin",
      "montmelian",
      "le-bourget-du-lac",
      "la-ravoire",
      "challes-les-eaux",
      "saint-alban-leysse",
      "barberaz",
      "jacob-bellecombette",
    ],
    description:
      "Annuaire des boucheries halal en Savoie. Chambéry, Aix-les-Bains, Albertville et tout le bassin chambérien (La Ravoire, Challes-les-Eaux, Le Bourget-du-Lac…). Commandez en ligne avec Klik&Go.",
    context:
      "La Savoie compte plus de 430 000 habitants répartis entre la cluse chambérienne, le bassin aixois et les vallées alpines (Tarentaize, Maurienne, Beaufortain). La communauté musulmane savoyarde est historiquement implantée à Chambéry (quartiers de Bissy, Cognin, Chambéry-le-Haut), Aix-les-Bains et dans la vallée de la Maurienne. Klik&Go référence les boucheries halal certifiées de toute la Savoie pour vous permettre de commander en ligne et de récupérer votre viande halal en click & collect, sans frais de service supérieurs à 0,99€ par commande. Les bouchers partenaires sélectionnent leurs viandes auprès d'éleveurs savoyards : agneaux des Bauges, bœuf alpin, volailles fermières des Dombes.",
  },
  {
    slug: "haute-savoie",
    name: "Haute-Savoie",
    region: "Auvergne-Rhône-Alpes",
    citySlugs: ["annecy", "annemasse", "thonon-les-bains", "cluses"],
    description:
      "Annuaire des boucheries halal en Haute-Savoie. Annecy, Annemasse, Thonon-les-Bains, Cluses — commandez votre viande halal en ligne avec Klik&Go.",
    context:
      "La Haute-Savoie, frontalière de la Suisse et de l'Italie, compte plus de 830 000 habitants. Les communautés musulmanes haut-savoyardes sont installées à Annecy (Cran-Gevrier, Seynod, Meythet), Annemasse, Thonon-les-Bains et dans la vallée de l'Arve (Cluses, Sallanches). Klik&Go référence les boucheries halal certifiées de tout le département pour vous permettre de commander en ligne. Frais de service : 0,99€ par commande, pas d'abonnement, retrait en boutique au créneau choisi.",
  },
  {
    slug: "isere",
    name: "Isère",
    region: "Auvergne-Rhône-Alpes",
    citySlugs: [
      "grenoble",
      "echirolles",
      "saint-martin-dheres",
      "fontaine",
      "voiron",
      "bourgoin-jallieu",
      "vienne",
    ],
    description:
      "Annuaire des boucheries halal en Isère. Grenoble, Échirolles, Saint-Martin-d'Hères, Voiron, Bourgoin-Jallieu — commandez en ligne avec Klik&Go.",
    context:
      "L'Isère, 8e département le plus peuplé de France (1,3M habitants), abrite l'une des plus anciennes communautés musulmanes du sud-est, principalement dans l'agglomération grenobloise (Villeneuve, Mistral, Teisseire, Échirolles, Saint-Martin-d'Hères, Fontaine) et le Nord-Isère (Bourgoin-Jallieu, l'Isle d'Abeau, Vienne). Klik&Go référence les boucheries halal certifiées de tout le département pour vous permettre de commander en ligne et de récupérer votre viande halal en click & collect. Frais de service : 0,99€ par commande.",
  },
  {
    slug: "rhone",
    name: "Rhône",
    region: "Auvergne-Rhône-Alpes",
    citySlugs: [
      "lyon",
      "villeurbanne",
      "venissieux",
      "vaulx-en-velin",
      "bron",
      "saint-priest",
      "meyzieu",
      "rillieux-la-pape",
      "givors",
      "oullins",
      "decines-charpieu",
    ],
    description:
      "Annuaire des boucheries halal dans le Rhône et le Grand Lyon. Lyon, Villeurbanne, Vénissieux, Vaulx-en-Velin, Bron, Saint-Priest — commandez en ligne avec Klik&Go.",
    context:
      "Le département du Rhône, dominé par la métropole de Lyon (1,4M habitants), abrite l'une des plus grandes communautés musulmanes de France après Paris et Marseille. Le Grand Lyon — Lyon (Guillotière, Vaise, Croix-Rousse, Gerland, Part-Dieu), Villeurbanne (Gratte-Ciel, Tonkin, Cusset), Vénissieux (Minguettes, Parilly), Vaulx-en-Velin, Bron, Saint-Priest, Meyzieu — concentre des centaines de boucheries halal de quartier. Klik&Go référence les boucheries halal certifiées de tout le département pour vous permettre de commander en ligne et de récupérer votre viande halal en click & collect. Les bouchers partenaires sélectionnent leurs viandes auprès d'éleveurs du Beaujolais, du Bugey et du Sud-Lyonnais.",
  },
  {
    slug: "loire",
    name: "Loire",
    region: "Auvergne-Rhône-Alpes",
    citySlugs: ["saint-etienne", "roanne", "firminy"],
    description:
      "Annuaire des boucheries halal dans la Loire. Saint-Étienne, Roanne, Firminy — commandez en ligne avec Klik&Go et récupérez en click & collect.",
    context:
      "La Loire, département de la région Auvergne-Rhône-Alpes (760 000 habitants), abrite une communauté musulmane historiquement implantée à Saint-Étienne (Bellevue, Tarentaize, Beaubrun, Crêt-de-Roc, Montreynaud), dans la vallée de l'Ondaine (Firminy, Le Chambon-Feugerolles) et à Roanne. Les boucheries halal de la Loire proposent une viande halal certifiée issue principalement d'élevages du Forez, du Pilat et du Roannais. Klik&Go référence les boucheries halal certifiées de tout le département pour commander en ligne avec retrait en boutique. Frais de service : 0,99€.",
  },
] as const;

/**
 * Helper : trouve le département d'une ville à partir de son slug.
 */
export function getDepartmentForCity(citySlug: string): SeoDepartment | undefined {
  return SEO_DEPARTMENTS.find((d) => d.citySlugs.includes(citySlug));
}
