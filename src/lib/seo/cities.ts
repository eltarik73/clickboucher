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
    // Description riche en mots-clés cibles longue traîne 2026 (audit SEO 2026-05-15).
    // Couvre : "boucherie halal chambery", "viande halal chambery", "commande viande halal",
    // "boucher halal chambery centre-ville", "boucherie halal chambery le haut", "aid chambery".
    description:
      "Boucheries halal à Chambéry : commandez votre viande halal en ligne (bœuf, agneau, volaille, merguez maison) et récupérez en boutique dans toute l'agglomération chambérienne. Centre-ville, Chambéry-le-Haut, Bissy, Cognin — boucher halal de proximité, click & collect rapide, prix justes, frais 0,99€.",
    latitude: 45.5646,
    longitude: 5.9178,
    // Districts élargis pour couvrir TOUTE l'agglomération chambérienne (mot-clé longue traîne).
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
    // localContext enrichi 350+ mots — couvre business-critical SEO + entités locales
    // + mots-clés "agglomération chambérienne", "métropole Savoie", "Grand Chambéry",
    // "aïd à Chambéry", "boucher musulman Chambéry" (recherches identifiées GSC).
    localContext:
      "Chambéry, préfecture de la Savoie au cœur de la métropole Grand Chambéry (135 000 habitants), compte une communauté musulmane active estimée à 8-10% de la population, principalement implantée dans le centre-ville, Chambéry-le-Haut (le grand quartier nord), Bissy (zone Bissy-Chamoux), et l'agglomération immédiate (Cognin, La Motte-Servolex, Bassens, Saint-Alban-Leysse, Barberaz). Les boucheries halal de Chambéry approvisionnent les familles savoyardes en viande fraîche certifiée pour le quotidien comme pour les grandes occasions : Aïd al-Fitr, Aïd al-Adha, Ramadan, mariages, baptêmes. Pour l'Aïd al-Adha, les bouchers halal chambériens prennent les réservations 4 à 6 semaines à l'avance (agneau entier, demi-agneau, méchoui complet). Avec Klik&Go, fini la file d'attente du samedi matin et du vendredi soir avant Maghrib : commandez en quelques minutes depuis chez vous ou la pause déjeuner, payez en ligne ou sur place, et récupérez votre viande au créneau choisi (30 min minimum). Les bouchers partenaires sélectionnent leurs élevages avec soin — agneaux savoyards (Beaufortain, Maurienne, Tarentaise), bœuf des Alpes, veau de Savoie, volailles fermières du Bugey — pour vous offrir une viande de proximité, halal certifiée (AVS, ACMIF, Mosquée de Paris selon le boucher), traçable et à des prix justes. Klik&Go ne prend pas de commission cachée : 0,99€ de frais de service unique par commande, jamais plus. Pas d'abonnement, pas d'engagement, pas de surcoût caché sur les produits.",
    specialty:
      "agneau de Savoie pour Aïd al-Adha, gigot pour tajine, brochettes pour grillade au lac du Bourget, merguez maison, kefta, viande hachée fraîche, escalope de veau",
  },
  {
    slug: "aix-les-bains",
    name: "Aix-les-Bains",
    region: "Savoie",
    description:
      "Boucheries halal à Aix-les-Bains et Communauté d'Agglomération Grand Lac (CALB). Commandez votre viande halal en ligne (bœuf, agneau, volaille, merguez maison) et récupérez en boutique dans toute l'agglomération aixoise. Centre-ville, Marlioz, Mémard, Sierroz, Lafin, Grésy-sur-Aix, Le Bourget-du-Lac — boucher halal de proximité, click & collect rapide, frais 0,99€.",
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
      "Aix-les-Bains, ville thermale de 30 000 habitants au bord du lac du Bourget, est le cœur de la Communauté d'Agglomération Grand Lac (CALB, 40 communes, 75 000 habitants). La ville compte une communauté musulmane installée depuis les vagues d'immigration ouvrière du XXe siècle, particulièrement présente dans les quartiers Sierroz, Lafin, Mémard, Boucher et Franklin Roosevelt. Saison thermale oblige (de mars à novembre), Aix-les-Bains accueille en plus chaque année des dizaines de milliers de curistes et touristes, ce qui double la demande estivale en viande fraîche pour les grillades au bord du lac, méchouis familiaux et repas de mariage. Les boucheries halal d'Aix-les-Bains et de l'agglomération (Grésy-sur-Aix, Le Bourget-du-Lac, Tresserve, Brison-Saint-Innocent, Voglans, Drumettaz-Clarafond, Mouxy) approvisionnent les familles aixoises en viande halal certifiée pour le quotidien comme pour les grandes occasions : Aïd al-Fitr, Aïd al-Adha, Ramadan, mariages, baptêmes. Pour l'Aïd al-Adha, les bouchers halal aixois prennent les réservations 4 à 6 semaines à l'avance (agneau entier, demi-agneau, méchoui complet 15-25 kg). Avec Klik&Go, fini la file d'attente du samedi matin sur les avenues Marie-de-Solms et Lord Revelstoke : commandez en quelques minutes depuis chez vous ou la pause cure, payez en ligne ou sur place, et récupérez votre viande au créneau choisi (30 min minimum). Les bouchers partenaires sélectionnent leurs élevages avec soin — agneaux savoyards (Beaufortain, Bauges, Massif des Bauges), bœuf des Alpes, veau de la Combe de Savoie, volailles fermières du Bugey et de la Dombes — pour une viande halal de proximité, certifiée (AVS, ACMIF, Mosquée de Paris selon le boucher), traçable et à prix juste. Klik&Go ne prend pas de commission cachée : 0,99€ de frais de service unique par commande, jamais plus. Pas d'abonnement, pas d'engagement.",
    specialty:
      "agneau de Savoie pour Aïd al-Adha, méchoui complet pour grillades au lac du Bourget, merguez maison, kefta, viande hachée fraîche, escalope de veau, brochettes, volailles fermières du Bugey",
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
  // ─────────────────────────────────────────────────
  // AJOUT 2026-05-15 — Compléter l'agglomération chambérienne
  // (Grand Chambéry, Métropole Savoie) sur demande du user.
  // Priorité business : Chambéry + couronne immédiate.
  // ─────────────────────────────────────────────────
  {
    slug: "bassens",
    name: "Bassens",
    region: "Savoie",
    description:
      "Boucheries halal à Bassens (Savoie). Commandez votre viande halal en click & collect dans la banlieue nord-est de Chambéry.",
    latitude: 45.5894,
    longitude: 5.9442,
    districts: ["Centre", "Les Combes", "Le Villard"],
    localContext:
      "Bassens, commune de la couronne chambérienne (3 800 habitants) au nord-est de Chambéry, fait partie intégrante de Grand Chambéry. Bordée par la Leysse et adossée au Mont Saint-Michel, elle accueille des familles installées de longue date ainsi que de nouveaux habitants attirés par la proximité du centre-ville (5 min en voiture) et l'accès facile à l'A41. Les boucheries halal de Chambéry centre, Bassens et Saint-Alban-Leysse desservent les habitants. Avec Klik&Go, commandez la veille pour récupérer votre viande halal le lendemain, sans la queue habituelle du samedi matin. Frais de service unique 0,99€.",
    specialty: "agneau pour Aïd, viande fraîche pour BBQ, kefta, brochettes",
  },
  {
    slug: "voglans",
    name: "Voglans",
    region: "Savoie",
    description:
      "Boucheries halal à Voglans. Click & collect halal entre Chambéry et Aix-les-Bains. Commande en ligne, retrait rapide.",
    latitude: 45.6228,
    longitude: 5.8825,
    districts: ["Le Bourg", "Les Iles"],
    localContext:
      "Voglans, commune de 1 800 habitants située entre Chambéry et Aix-les-Bains au bord du lac du Bourget, abrite l'aéroport Chambéry-Savoie et un parc d'activités tertiaires. La population mélange résidents historiques, salariés du parc d'affaires et familles attirées par la proximité du lac. Les boucheries halal de Chambéry nord, Aix-les-Bains et La Motte-Servolex couvrent les besoins de la commune. Klik&Go vous permet de commander votre viande halal en ligne et de la récupérer au créneau choisi sur votre trajet domicile-travail. Pratique pour les actifs voglanais.",
    specialty: "agneau, brochettes lac du Bourget, viande pour grillades estivales",
  },
  {
    slug: "sonnaz",
    name: "Sonnaz",
    region: "Savoie",
    description:
      "Boucheries halal à Sonnaz (Savoie). Commandez votre viande halal en ligne dans l'agglomération chambérienne nord.",
    latitude: 45.6097,
    longitude: 5.8867,
    districts: ["Le Bourg", "La Buisse"],
    localContext:
      "Sonnaz, commune péri-urbaine de 1 700 habitants au nord de Chambéry sur la route d'Aix-les-Bains, conserve un caractère semi-rural tout en bénéficiant de la dynamique de l'agglomération chambérienne. Les habitants se ravitaillent en viande halal principalement à Chambéry-le-Haut, Voglans ou Aix-les-Bains. Klik&Go simplifie le parcours : commandez en ligne chez votre boucher halal préféré, récupérez en boutique au créneau choisi, sans détour ni file d'attente. Frais de service 0,99€ par commande.",
    specialty: "agneau de Savoie, viande halal pour méchoui, volailles",
  },
  {
    slug: "vimines",
    name: "Vimines",
    region: "Savoie",
    description:
      "Boucheries halal à Vimines (Savoie). Click & collect halal dans la banlieue sud-ouest de Chambéry.",
    latitude: 45.5414,
    longitude: 5.8847,
    districts: ["Le Bourg", "Saint-Cassin"],
    localContext:
      "Vimines, commune résidentielle de 2 200 habitants au sud-ouest de Chambéry sur les flancs du Mont du Chat, attire des familles cherchant le calme et la proximité de la nature tout en restant à 10 minutes du centre de Chambéry. Les habitants se ravitaillent en viande halal à Cognin, Jacob-Bellecombette ou Chambéry centre. Avec Klik&Go, finie la perte de temps : commandez en quelques clics, récupérez votre commande sans attendre. Idéal pour les actifs viminois qui rentrent du travail.",
    specialty: "agneau, viande pour kefta, brochettes, volailles fermières",
  },
  {
    slug: "saint-cassin",
    name: "Saint-Cassin",
    region: "Savoie",
    description:
      "Boucheries halal proches de Saint-Cassin. Commandez votre viande halal en click & collect dans l'agglomération sud chambérienne.",
    latitude: 45.5392,
    longitude: 5.8556,
    districts: ["Le Bourg"],
    localContext:
      "Saint-Cassin, petite commune savoyarde de 900 habitants au sud-ouest de Chambéry, conserve un caractère rural préservé sur les hauteurs du massif du Mont du Chat. Pour leur viande halal, les habitants se tournent vers les boucheries de Vimines, Cognin ou Chambéry centre, distantes de 10 à 15 minutes en voiture. Klik&Go permet de commander en ligne depuis chez soi et de récupérer la commande sur le trajet retour du travail ou des courses à Chambéry. Frais 0,99€ par commande, pas d'abonnement.",
    specialty: "agneau, viande halal pour Aïd, brochettes maison",
  },
  {
    slug: "saint-baldoph",
    name: "Saint-Baldoph",
    region: "Savoie",
    description:
      "Boucheries halal à Saint-Baldoph. Click & collect halal dans la couronne sud de l'agglomération chambérienne.",
    latitude: 45.53,
    longitude: 5.9261,
    districts: ["Le Bourg", "Les Charmettes"],
    localContext:
      "Saint-Baldoph, commune résidentielle de 1 900 habitants au sud de Chambéry au pied de la Chartreuse, fait partie de Grand Chambéry. Située à 8 minutes du centre-ville, elle attire les familles cherchant un cadre de vie calme à proximité immédiate de l'agglomération. Les boucheries halal de La Ravoire, Challes-les-Eaux et Chambéry sud servent les habitants. Avec Klik&Go, plus besoin de planifier vos courses : commandez en ligne et passez récupérer votre viande au créneau choisi en repassant à Chambéry. Pas de file d'attente, pas de surcoût.",
    specialty: "agneau, viande pour grillades, kefta maison, volailles",
  },
  {
    slug: "drumettaz-clarafond",
    name: "Drumettaz-Clarafond",
    region: "Savoie",
    description:
      "Boucheries halal à Drumettaz-Clarafond. Click & collect halal au cœur du couloir Chambéry-Aix-les-Bains.",
    latitude: 45.6486,
    longitude: 5.9094,
    districts: ["Drumettaz", "Clarafond", "La Brisolette"],
    localContext:
      "Drumettaz-Clarafond, commune de 3 000 habitants située au cœur du couloir Chambéry-Aix-les-Bains, bénéficie d'une croissance démographique régulière grâce à sa proximité avec les deux pôles urbains de la Savoie. Les boucheries halal d'Aix-les-Bains, Voglans, La Motte-Servolex et Chambéry nord couvrent les besoins des habitants. Klik&Go permet aux Drumettazois de commander en ligne et de récupérer leur viande halal en quelques minutes, sans le détour parfois nécessaire pour passer par une boucherie spécifique.",
    specialty: "agneau, brochettes pour BBQ d'été au lac, viande pour méchoui",
  },
  // === AGGLO AIX-LES-BAINS / GRAND LAC (CALB) — Sprint mai 2026 ===
  {
    slug: "gresy-sur-aix",
    name: "Grésy-sur-Aix",
    region: "Savoie",
    description:
      "Boucheries halal à Grésy-sur-Aix. Click & collect halal dans la première couronne nord d'Aix-les-Bains, axe Annecy.",
    latitude: 45.7233,
    longitude: 5.9358,
    districts: ["Centre", "Antoger", "Le Mollard", "Saint-Victor", "Saint-Pierre"],
    localContext:
      "Grésy-sur-Aix, commune de 4 000 habitants en première couronne nord d'Aix-les-Bains sur l'axe Annecy (D1201), fait partie de la Communauté d'Agglomération Grand Lac (CALB). La commune a connu une forte croissance démographique avec l'arrivée de familles attirées par sa proximité immédiate avec Aix-les-Bains (5 min en voiture), son cadre verdoyant adossé au massif du Revard, et l'accès direct à la voie rapide A41. Les boucheries halal d'Aix-les-Bains centre (Sierroz, Lafin, Mémard) et de Grésy-sur-Aix desservent les habitants. Avec Klik&Go, commandez la veille pour récupérer votre viande halal le lendemain au créneau qui vous arrange, sans la queue habituelle du samedi matin. Pratique pour les grandes occasions (Aïd al-Adha, mariages) comme pour le quotidien. Frais de service unique 0,99€, sans surcoût caché.",
    specialty: "agneau pour Aïd, viande pour grillades estivales, méchoui familial, merguez maison",
  },
  {
    slug: "tresserve",
    name: "Tresserve",
    region: "Savoie",
    description:
      "Boucheries halal à Tresserve. Click & collect halal sur la péninsule du lac du Bourget, agglomération Aix-les-Bains.",
    latitude: 45.6709,
    longitude: 5.8959,
    districts: ["Centre", "Le Plat", "Les Tournelles", "Pré Tampin"],
    localContext:
      "Tresserve, commune de 3 000 habitants sur la péninsule rive est du lac du Bourget, fait partie intégrante de la Communauté d'Agglomération Grand Lac (CALB) au sud d'Aix-les-Bains. Bénéficiant d'une situation exceptionnelle entre lac et collines, la commune accueille à la fois des résidents permanents et des résidences secondaires de la métropole lyonnaise et chambérienne. Les boucheries halal d'Aix-les-Bains, du Bourget-du-Lac et de Tresserve approvisionnent les habitants en viande halal certifiée. Klik&Go permet aux Tresservois de commander en ligne et de récupérer leur viande au créneau choisi, particulièrement pratique l'été pour préparer barbecues et méchouis sur la plage du Lido ou en bord de lac sans perdre de temps. Service de 0,99€ par commande, jamais plus.",
    specialty:
      "agneau pour méchoui de bord de lac, brochettes pour BBQ estival, viande hachée fraîche, kefta, escalopes de poulet pour terrasse",
  },
  {
    slug: "mouxy",
    name: "Mouxy",
    region: "Savoie",
    description:
      "Boucheries halal à Mouxy. Click & collect halal sur les hauteurs d'Aix-les-Bains, en route vers le Revard.",
    latitude: 45.6856,
    longitude: 5.9436,
    districts: ["Centre", "Le Tomet", "La Croix"],
    localContext:
      "Mouxy, commune de 1 000 habitants sur les premières hauteurs à l'est d'Aix-les-Bains, à 5 minutes en voiture du centre thermal, sur la route du Mont Revard. Petite commune résidentielle de la Communauté d'Agglomération Grand Lac (CALB), Mouxy accueille des familles aixoises qui ont choisi le calme et la vue panoramique sur le lac du Bourget. Les boucheries halal d'Aix-les-Bains centre (avenues Marie-de-Solms, Boucher, Lafin) et de l'agglomération couvrent les besoins des Mouxyards. Klik&Go évite le détour en ville le samedi matin : commandez en quelques minutes, récupérez votre viande halal au créneau choisi, frais unique 0,99€. Pratique aussi pour les grandes occasions familiales.",
    specialty: "agneau pour Aïd, viande halal pour grillades, brochettes, merguez maison",
  },
  {
    slug: "brison-saint-innocent",
    name: "Brison-Saint-Innocent",
    region: "Savoie",
    description:
      "Boucheries halal à Brison-Saint-Innocent. Click & collect halal au nord d'Aix-les-Bains, rive est du lac du Bourget.",
    latitude: 45.7211,
    longitude: 5.8783,
    districts: ["Brison-les-Oliviers", "Saint-Innocent", "Grumeau", "Centre"],
    localContext:
      "Brison-Saint-Innocent, commune de 2 000 habitants juste au nord d'Aix-les-Bains sur la rive est du lac du Bourget, fait partie de la Communauté d'Agglomération Grand Lac (CALB). Réputée pour son climat doux et son ensoleillement exceptionnel pour la région (parfois surnommée « la riviera savoyarde »), la commune compte une population active mêlant résidents permanents, navetteurs vers Aix-les-Bains et Chambéry, et propriétaires de résidences secondaires. Les boucheries halal d'Aix-les-Bains centre (Sierroz, Lafin), de Grésy-sur-Aix et de la rive est du lac desservent les habitants de Brison-Saint-Innocent. Klik&Go évite le détour systématique en centre-ville d'Aix : commandez en ligne, choisissez votre créneau de retrait, récupérez votre viande halal en quelques minutes. Frais unique 0,99€ par commande, pas d'abonnement.",
    specialty:
      "agneau pour méchoui ensoleillé, brochettes pour BBQ au bord du lac, viande pour mariages et grandes tablées",
  },
  {
    slug: "mery",
    name: "Méry",
    region: "Savoie",
    description:
      "Boucheries halal à Méry. Click & collect halal entre Aix-les-Bains et Chambéry, agglomération Grand Lac.",
    latitude: 45.6633,
    longitude: 5.9119,
    districts: ["Centre", "Saint-Maurice", "Champagneux"],
    localContext:
      "Méry, commune de 1 400 habitants située entre Chambéry et Aix-les-Bains sur l'axe Voglans-Drumettaz, appartient à la Communauté d'Agglomération Grand Lac (CALB). Petite commune résidentielle en croissance, Méry bénéficie d'une position centrale qui permet à ses habitants d'accéder aussi bien aux services chambériens qu'aux commerces aixois en moins de 10 minutes. Les boucheries halal de Voglans, Aix-les-Bains, Drumettaz-Clarafond et La Motte-Servolex desservent les Mérysiens. Avec Klik&Go, commandez votre viande halal en ligne, choisissez le boucher partenaire de votre choix dans l'agglomération, et récupérez au créneau qui vous arrange. Frais de service unique 0,99€, sans abonnement ni surcoût caché.",
    specialty: "agneau, viande pour BBQ familial, kefta, viande hachée fraîche pour quotidien",
  },
  {
    slug: "albens",
    name: "Albens",
    region: "Savoie",
    description:
      "Boucheries halal à Albens (Entrelacs). Click & collect halal au nord du lac du Bourget, axe Annecy-Aix-les-Bains.",
    latitude: 45.7886,
    longitude: 5.9483,
    districts: ["Albens centre", "Saint-Germain", "Cessens", "Saint-Girod"],
    localContext:
      "Albens (commune historique aujourd'hui intégrée à Entrelacs depuis 2016), pôle local de 5 000 habitants au nord du lac du Bourget sur l'axe Aix-les-Bains - Annecy (D1201, 15 min de chaque), constitue un bourg actif avec ses commerces, écoles et marchés hebdomadaires. La commune appartient à la Communauté de Communes de la Cluse des Hôpitaux et bénéficie d'une croissance démographique soutenue grâce à sa position entre les deux pôles thermaux savoyards. Les boucheries halal d'Aix-les-Bains, de Grésy-sur-Aix et d'Annecy desservent les Albanais. Klik&Go permet aux habitants de commander en ligne et de récupérer leur viande halal sans devoir faire 15 minutes de voiture pour Aix ou Annecy. Frais unique 0,99€ par commande.",
    specialty:
      "agneau de Savoie pour Aïd, méchoui pour fêtes de village, viande pour grandes tablées familiales",
  },
  {
    slug: "yenne",
    name: "Yenne",
    region: "Savoie",
    description:
      "Boucheries halal à Yenne. Click & collect halal au sud du lac du Bourget, vallée du Rhône, axe Lyon-Chambéry.",
    latitude: 45.7044,
    longitude: 5.7611,
    districts: ["Centre", "Lépin-le-Lac", "Saint-Paul", "Sainte-Marie"],
    localContext:
      "Yenne, chef-lieu de canton de 3 000 habitants au sud du lac du Bourget dans la vallée du Rhône, constitue le pôle commercial et administratif de l'Avant-Pays Savoyard. Sa position stratégique sur l'axe Lyon-Chambéry (A43, sortie Yenne) et à 20 minutes d'Aix-les-Bains en fait un nœud naturel pour les habitants du Bugey, de la Chautagne et de l'Avant-Pays. La commune accueille un marché hebdomadaire dynamique et des commerces de proximité. Les boucheries halal d'Aix-les-Bains, de Belley (Ain voisin) et de Chambéry desservent les Yennois. Avec Klik&Go, plus besoin de programmer un détour de 20 minutes : commandez votre viande halal en ligne, choisissez le boucher partenaire le plus pratique, récupérez au créneau qui vous arrange. Frais unique 0,99€.",
    specialty:
      "agneau, viande pour grandes occasions familiales, méchoui, viande pour mariages et baptêmes",
  },
  {
    slug: "pugny-chatenod",
    name: "Pugny-Chatenod",
    region: "Savoie",
    description:
      "Boucheries halal à Pugny-Chatenod. Click & collect halal sur les hauteurs est d'Aix-les-Bains, vers le Revard.",
    latitude: 45.6961,
    longitude: 5.96,
    districts: ["Pugny", "Chatenod", "Le Mollard"],
    localContext:
      "Pugny-Chatenod, petite commune de 700 habitants sur les pentes à l'est d'Aix-les-Bains en direction du Mont Revard, fait partie de la Communauté d'Agglomération Grand Lac (CALB). Commune résidentielle de haut perchée offrant une vue exceptionnelle sur le lac du Bourget, Pugny-Chatenod accueille des familles aixoises qui ont choisi la tranquillité montagnarde tout en restant à 10 minutes du centre-ville. Les boucheries halal d'Aix-les-Bains centre (avenues Marie-de-Solms, Boucher, Sierroz) et de l'agglomération desservent les Pugnatois. Klik&Go évite le détour systématique en ville : commandez en ligne, récupérez votre viande halal au créneau choisi à Aix-les-Bains ou commune voisine. Service 0,99€ par commande.",
    specialty:
      "agneau pour Aïd, méchoui montagne, brochettes pour repas en altitude, viande pour familles",
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
