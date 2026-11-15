/**
 * Editorial data of the occasion x city pages (/occasions/[occasion]/[ville]).
 *
 * Every text here is rendered whatever the number of shops in the city, so it
 * must stay true with zero shop: it describes the occasion, the quantities and
 * the lead times, never what a listed shop offers, and never a fee, a payment
 * mode, a delivery or a halal-compliance claim (wording rules D6 of chantier C1-SEO,
 * pinned by src/lib/__tests__/seo/seo-data.test.ts). Occasion names never
 * contain « halal »: the page templates add it.
 */

export type SeoOccasion = {
  slug: string;
  name: string;
  /** Mot-clé principal pour title */
  keyword: string;
  /** Catégorie événement Schema.org. Si absent OU pas de eventStart →
   *  on utilise WebPage au lieu de Event (GSC refuse Event sans startDate). */
  eventType?: "FoodEvent" | "Event";
  /** Date de l'évènement (ISO yyyy-mm-dd) — REQUIS pour schema Event.
   *  Renseigné uniquement pour les occasions à date fixe (Aïd, Ramadan).
   *  Mariage/aqiqa/méchoui/barbecue/buffet = pas de date → WebPage schema. */
  eventStart?: string;
  eventEnd?: string;
  /** Description courte pour metadata */
  shortDescription: string;
  /** Intro éditoriale unique 250+ mots (E-E-A-T, anti-thin) */
  intro: string;
  /** Quantité de viande recommandée par personne */
  servingTip: { question: string; answer: string };
  /** Délai de commande recommandé */
  bookingDelay: string;
  /** Saison où la page est plus active */
  season?: "spring" | "summer" | "ramadan" | "year-round";
  priority: "P0" | "P1" | "P2";
  /** Date (ISO yyyy-mm-dd) de la dernière vraie modification du contenu de
   *  CETTE occasion. Si absent → date commune du template (page + sitemap).
   *  À renseigner uniquement quand le texte de l'occasion change réellement. */
  lastUpdated?: string;
};

export const SEO_OCCASIONS: readonly SeoOccasion[] = [
  {
    slug: "aid-al-adha",
    name: "Aïd al-Adha",
    keyword: "viande aïd al-adha",
    eventType: "Event",
    // Aïd al-Adha 1448 AH ~ 16 mai 2027 (calcul lunaire : conjonction le
    // 6 mai 2027 ; +1j possible selon l'observation de la lune, annonce
    // officielle début mai 2027). Festivités sur 4 jours. Prochain bump après
    // le 20 mai 2027, pour 1449 AH (~5 mai 2028).
    // bookingDelay : pas de ":" — la page affiche `bookingDelay.split(":")[1]`
    // dans le hero et doit garder le libellé de repli pour l'Aïd.
    eventStart: "2027-05-16",
    eventEnd: "2027-05-20",
    lastUpdated: "2026-11-15",
    shortDescription:
      "Aïd al-Adha 2027 : choisir son agneau ou son mouton, prévoir les quantités, réserver à temps et commander en click & collect sur Klik&Go.",
    intro:
      "L'Aïd al-Adha, aussi appelé Aïd el-Kébir, est l'une des deux grandes fêtes de l'islam. Il commémore le sacrifice d'Abraham et tombe le 10e jour du mois de dhou al-hijja. Les familles qui en ont les moyens sacrifient un animal, le plus souvent un mouton, dont la viande est traditionnellement partagée en trois parts : le foyer, les proches et les personnes dans le besoin. En 2027, l'Aïd al-Adha est attendu autour du 16 mai ; la date exacte est confirmée quelques jours avant, selon l'observation de la lune. En France, l'abattage rituel n'est autorisé qu'en abattoir. Pour une bête entière, demandez donc à votre boucherie halal comment elle s'organise avec l'abattoir et sous quelle forme la viande vous sera remise : carcasse entière, demi-carcasse ou morceaux découpés et mis sous vide. Si vous n'avez pas besoin d'une bête entière, le gigot, l'épaule, les côtelettes, le collier et la souris d'agneau s'achètent au poids, pour les repas de fête comme pour les invités. Les semaines qui précèdent l'Aïd sont très chargées pour les boucheries halal : réservez tôt, et vérifiez avec le boucher le jour et le créneau où vous viendrez chercher votre commande.",
    servingTip: {
      question: "Quelle quantité d'agneau ou de mouton prévoir pour l'Aïd ?",
      answer:
        "Une bête entière se partage traditionnellement en trois parts : le foyer, les proches et les personnes dans le besoin. Le poids de viande dépend de l'animal : demandez à votre boucher le poids de carcasse attendu avant de réserver. Si vous commandez des morceaux pour les repas de fête, comptez 300 à 400 g d'agneau avec os par adulte, par exemple pour un gigot ou une épaule rôtie.",
    },
    bookingDelay:
      "Réservez 3 à 4 semaines avant la fête — pour l'Aïd 2027, attendu autour du 16 mai, dès la mi-avril.",
    season: "summer",
    priority: "P0",
  },
  {
    slug: "mechoui",
    name: "Méchoui",
    keyword: "méchoui",
    // Pas de eventType : pas de date fixe → WebPage schema (Event sans
    // startDate refusé par GSC).
    lastUpdated: "2026-11-15",
    shortDescription:
      "Méchoui : choisir l'agneau entier, calculer la quantité selon le nombre d'invités, réussir la cuisson à la broche et commander à temps.",
    intro:
      "Le méchoui est un agneau entier rôti lentement à la broche, au feu de bois ou sur des braises. Venu du Maghreb, c'est un plat de fête : mariages, naissances, retrouvailles familiales, grandes tablées d'été. Tout commence par la bête : un agneau jeune, entier et vidé, dont la taille doit correspondre à votre broche et au nombre de vos invités. La veille, on l'enduit d'un mélange de beurre, d'ail, de cumin, de paprika et de sel ; le jour venu, on le cuit plusieurs heures en l'arrosant régulièrement, jusqu'à ce que la viande se détache sans effort. Quand le méchoui est le plat principal, comptez 500 à 700 g d'agneau avec os par adulte, un peu moins si vous servez aussi des merguez ou des brochettes. Un agneau entier ne s'improvise pas : la boucherie doit souvent le commander, il faut donc réserver plusieurs jours à l'avance et préciser le poids souhaité. Sur Klik&Go, chaque boucherie présente ses produits sur sa page : vérifiez si elle propose l'agneau entier, puis choisissez votre créneau de retrait en boutique.",
    servingTip: {
      question: "Combien d'agneau pour un méchoui de 30 personnes ?",
      answer:
        "Sur la base de 500 à 700 g d'agneau avec os par adulte, 30 invités demandent 15 à 21 kg d'agneau, soit en général un agneau entier d'environ 18 à 20 kg. Pour 50 personnes, prévoyez deux agneaux. Si vous servez aussi des merguez et des brochettes, vous pouvez réduire un peu la quantité d'agneau.",
    },
    bookingDelay: "Délai conseillé : commandez au moins une semaine avant l'événement.",
    season: "summer",
    priority: "P0",
  },
  {
    slug: "mariage",
    name: "Mariage",
    keyword: "viande mariage halal",
    // Pas de eventType : date personnelle, pas universelle → WebPage schema.
    lastUpdated: "2026-11-15",
    shortDescription:
      "Mariage : combien de viande halal prévoir par invité, comment répartir agneau, bœuf et volaille, et quand passer commande pour la fête.",
    intro:
      "Un mariage réunit souvent une centaine d'invités, parfois bien plus, autour d'un repas où la viande halal tient la place centrale : méchoui d'agneau, brochettes, kefta, couscous royal, tajines de poulet ou d'agneau aux pruneaux. Pour bien commander, partez du menu. Un plat en sauce demande moins de viande par personne qu'un buffet de grillades, et les entrées, les accompagnements et les desserts font varier les quantités. Pour un repas de fête complet, comptez en moyenne 600 à 700 g de viande crue, os compris, par adulte. Faites ensuite la liste par type de viande (agneau, bœuf, volaille, viande hachée) et prenez contact avec la boucherie plusieurs semaines avant la date : les agneaux entiers et les grosses quantités se réservent. Pensez aussi à l'organisation du jour J : où stocker la viande au froid, qui la cuit, à quelle heure. Sur Klik&Go, vous pouvez répartir vos achats en plusieurs commandes, chacune avec son créneau de retrait en boutique, par exemple les viandes à mariner la veille et les grillades le jour même.",
    servingTip: {
      question: "Combien de viande pour un mariage de 100 personnes ?",
      answer:
        "Pour 100 adultes, comptez 60 à 70 kg de viande crue, os compris, soit 600 à 700 g par personne. Exemple de répartition : un agneau entier d'environ 18 kg pour le méchoui, 20 kg de brochettes (environ 200 pièces de 100 g), une quinzaine de poulets (environ 20 kg) et 7 kg de viande hachée pour la kefta.",
    },
    bookingDelay: "Délai conseillé : 2 à 4 semaines avant la date du mariage.",
    season: "year-round",
    priority: "P0",
  },
  {
    slug: "ramadan",
    name: "Ramadan",
    keyword: "viande ramadan",
    eventType: "FoodEvent",
    // Ramadan 1448 AH ≈ 8 fév – 8/9 mars 2027 ; Aïd el-Fitr 9 ou 10 mars 2027
    // (conjonction le 6 fév 2027 après le coucher du soleil à La Mecque).
    // Bumper chaque année après l'iftar du dernier jour.
    eventStart: "2027-02-08",
    eventEnd: "2027-03-08",
    lastUpdated: "2026-11-15",
    shortDescription:
      "Ramadan 2027 : quantités de viande halal pour l'iftar et le suhour, plats de tradition et commande en click & collect avant la rupture du jeûne.",
    intro:
      "Pendant le mois de Ramadan, les familles musulmanes jeûnent de l'aube au coucher du soleil, se retrouvent chaque soir pour rompre le jeûne (l'iftar) et prennent un repas avant l'aube (le suhour). En 2027, le Ramadan devrait commencer autour du 8 février et s'achever début mars, l'Aïd el-Fitr étant attendu le 9 ou le 10 mars ; les dates exactes dépendent de l'observation de la lune. La viande halal tient une place importante dans les repas du soir : harira à l'agneau ou au bœuf, chorba, brochettes, boulettes en sauce, tajines mijotés, pastilla au poulet, méchoui le week-end. Pour éviter les courses de dernière minute, beaucoup de familles prévoient leurs quantités pour la semaine : viande hachée pour la kefta et la harira, morceaux d'agneau à mijoter, poulet entier, merguez. Le click & collect permet de commander dans la journée et de passer récupérer la viande au créneau choisi, avant l'iftar.",
    servingTip: {
      question: "Quelle quantité de viande pour le Ramadan ?",
      answer:
        "Pour une famille de 5 personnes, comptez environ 4 à 5 kg de viande halal par semaine de Ramadan : 1 kg de viande hachée (kefta, harira), 1,5 kg d'agneau (tajine, brochettes), un poulet entier et 500 g de merguez. Adaptez selon vos repas et vos invités.",
    },
    bookingDelay:
      "Délai conseillé : le jour même selon les créneaux disponibles, la veille pour un iftar de plus de 10 personnes.",
    season: "ramadan",
    priority: "P0",
  },
  {
    slug: "aqiqa",
    name: "Aqiqa",
    keyword: "viande aqiqa",
    // Pas de eventType : date dépend de la naissance, pas universelle → WebPage.
    lastUpdated: "2026-11-15",
    shortDescription:
      "Aqiqa : quel mouton prévoir pour la naissance de votre enfant, comment partager la viande et quand réserver auprès de votre boucherie halal.",
    intro:
      "L'aqiqa est une tradition musulmane qui célèbre la naissance d'un enfant. Elle est recommandée le septième jour après la naissance ; selon une pratique courante, on sacrifie deux moutons pour un garçon et un pour une fille, et la viande est partagée entre la famille, les proches et les personnes dans le besoin. Beaucoup de familles en profitent pour réunir leurs proches autour d'un repas : couscous, tajine, agneau rôti. Comme pour l'Aïd, l'abattage rituel n'est autorisé en France qu'en abattoir : prévenez votre boucherie halal dès la naissance, pour qu'elle vous explique comment elle s'organise, quel poids de carcasse attendre et sous quelle forme la viande vous sera remise, entière, en demi-carcasse ou découpée en parts. Si vous préparez seulement le repas de fête, des morceaux au poids suffisent : épaule ou gigot pour le four, collier et souris pour le tajine.",
    servingTip: {
      question: "Quel poids de mouton pour une aqiqa ?",
      answer:
        "La tradition prévoit un mouton pour une fille et deux pour un garçon. Le poids de viande dépend de l'animal : demandez à votre boucher le poids de carcasse attendu avant de réserver. Pour le repas qui accompagne l'aqiqa, comptez 300 à 400 g d'agneau avec os par adulte.",
    },
    bookingDelay:
      "Délai conseillé : prévenez la boucherie dès la naissance, au moins 3 à 5 jours avant la date choisie.",
    season: "year-round",
    priority: "P1",
  },
  {
    slug: "barbecue",
    name: "Barbecue",
    keyword: "barbecue halal",
    // Pas de eventType : catégorie de produit pas un événement → WebPage.
    lastUpdated: "2026-11-15",
    shortDescription:
      "Barbecue halal : merguez, brochettes, côtes d'agneau, ailes de poulet… quantités par personne, marinades et temps de cuisson pour vos grillades.",
    intro:
      "Dès les beaux jours, le barbecue rassemble famille et amis, dans le jardin, sur une terrasse ou au bord d'un lac. Côté viande halal, les classiques se complètent : merguez, brochettes d'agneau ou de poulet marinées, côtes d'agneau, côte de bœuf, ailes de poulet épicées, kefta en brochettes. Misez sur la variété plutôt que sur la quantité d'un seul produit : prévoyez environ 600 g de viande crue par adulte quand le barbecue est le repas principal, moins s'il y a beaucoup d'accompagnements. Les marinades (huile d'olive, citron, ail, cumin, paprika, herbes) se préparent la veille pour l'agneau et le bœuf ; pour le poulet, quelques heures suffisent. Sortez la viande du réfrigérateur une demi-heure avant de la poser sur la grille, et cuisez les merguez à feu moyen pour qu'elles ne brûlent pas à l'extérieur. Avec le click & collect, vous pouvez commander le matin et passer récupérer votre viande en fin de journée, au créneau choisi.",
    servingTip: {
      question: "Quelle quantité de viande pour un barbecue halal de 10 personnes ?",
      answer:
        "Pour 10 adultes, comptez 5 à 6 kg de viande au total, soit environ 600 g par personne : 30 merguez (3 par personne), 10 brochettes d'agneau, 10 brochettes de poulet, 10 côtes d'agneau et 1 kg de viande hachée pour quelques burgers.",
    },
    bookingDelay:
      "Délai conseillé : un à deux jours avant pour un barbecue de week-end, le jour même en semaine selon les créneaux.",
    season: "summer",
    priority: "P0",
  },
  {
    slug: "buffet",
    name: "Buffet",
    keyword: "buffet halal",
    // Pas de eventType : catégorie de produit pas un événement → WebPage.
    lastUpdated: "2026-11-15",
    shortDescription:
      "Buffet halal : quelles viandes servir pour un apéritif dînatoire ou une réception, en quelles quantités, et comment les commander à l'avance.",
    intro:
      "Anniversaire, baptême, fête de fin d'année, réception d'entreprise : un buffet se compose de bouchées faciles à prendre à la main. Côté viande halal, les formats pratiques sont les mini-brochettes d'agneau ou de poulet, la kefta en boulettes ou sur pique, les mini-merguez, la viande hachée pour des mini-burgers et les blancs de poulet à paner. Pour un apéritif dînatoire, comptez 250 à 300 g de viande par personne ; pour une réception où d'autres plats sont servis, 150 g peuvent suffire. Préparez une liste par produit et précisez au boucher le format souhaité (taille des brochettes, calibre des merguez) dans la note de votre commande : la découpe et le façonnage demandent du temps pour les grandes quantités. Prévoyez enfin de garder la viande au froid jusqu'à la cuisson et de ne la sortir qu'au dernier moment.",
    servingTip: {
      question: "Combien de viande pour un buffet halal de 20 personnes ?",
      answer:
        "Pour un apéritif dînatoire de 20 personnes, comptez environ 5 kg de viande variée, soit 250 à 300 g par personne : 40 mini-brochettes, 20 mini-merguez, 1,5 kg de kefta sur pique, 1 kg de viande hachée pour des mini-burgers et 1 kg de blancs de poulet à paner.",
    },
    bookingDelay:
      "Délai conseillé : une semaine avant pour une réception de plus de 30 personnes, deux à trois jours avant pour un petit buffet.",
    season: "year-round",
    priority: "P1",
  },
];

/** Cities prioritaires pour les pages occasion×ville */
export const OCCASION_VILLE_PRIORITY_SLUGS = [
  "lyon",
  "grenoble",
  "saint-etienne",
  "chambery",
  "annecy",
  "villeurbanne",
  "venissieux",
  "aix-les-bains",
] as const;

/** Helper : retourne tous les couples occasion×ville pour SSG */
export function getOccasionCityCombinations(): Array<{ occasion: string; ville: string }> {
  const combos: Array<{ occasion: string; ville: string }> = [];
  for (const occ of SEO_OCCASIONS) {
    for (const ville of OCCASION_VILLE_PRIORITY_SLUGS) {
      combos.push({ occasion: occ.slug, ville });
    }
  }
  return combos;
}
