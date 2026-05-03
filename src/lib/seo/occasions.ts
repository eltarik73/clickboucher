/**
 * SEO occasions config — pages occasion x ville (Sprint 7).
 * Aïd al-Adha est volontairement exclu (sera fait en Sprint 13 séparé).
 *
 * Cible : "mechoui [ville]", "viande mariage halal [ville]", "ramadan boucherie [ville]",
 * "aqiqa mouton [ville]", "barbecue halal [ville]"
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
};

export const SEO_OCCASIONS: readonly SeoOccasion[] = [
  {
    slug: "aid-al-adha",
    name: "Aïd al-Adha",
    keyword: "viande aïd al-adha",
    eventType: "Event",
    // Aïd al-Adha 1447 AH ~ 26 mai 2026 (calcul lunaire — date Saudi
    // Arabia ; en France, +1j possible selon Mosquée de Paris). Festivités
    // sur 4 jours. Bumper l'an prochain pour 1448 AH.
    eventStart: "2026-05-26",
    eventEnd: "2026-05-30",
    shortDescription:
      "Commandez votre mouton ou agneau halal pour l'Aïd al-Adha 2026. Sacrifice rituel, découpe, conditionnement par votre boucher partenaire Klik&Go.",
    intro:
      "L'Aïd al-Adha (Aïd el-Kebir) est la plus grande fête religieuse musulmane, célébrant le sacrifice d'Abraham. Le 7e jour du mois de Dhul-Hijjah, chaque famille musulmane sacrifie un mouton, une chèvre, une vache ou un chameau, partagé en trois parts égales : la famille, les voisins et amis, et les pauvres. En 2026, l'Aïd al-Adha tombe en juin. Sur Klik&Go, les boucheries halal partenaires vous accompagnent pour la commande, le sacrifice rituel certifié halal, la découpe selon vos besoins (en parts familiales, conditionné sous vide ou en barquettes), et la mise à disposition au créneau choisi. Vous pouvez commander un mouton entier (12-18 kg vivant, soit 6-9 kg de viande nette), une demi-bête, ou directement des morceaux pré-découpés (gigot, épaule, côtelettes, abats). Anticipez : les boucheries halal ont énormément de commandes pendant l'Aïd, le carnet se remplit vite — réservez idéalement 3-4 semaines avant la date.",
    servingTip: {
      question: "Quelle quantité d'agneau / mouton pour l'Aïd 2026 ?",
      answer:
        "Pour une famille de 5 personnes, comptez un mouton entier (12-15 kg vivant, soit 6-8 kg de viande nette). Pour 8-10 personnes, un agneau de 18-20 kg. La règle traditionnelle : 1/3 famille (~2-3 kg), 1/3 voisins (~2-3 kg), 1/3 pauvres (~2-3 kg).",
    },
    bookingDelay: "RÉSERVEZ 3-4 SEMAINES AVANT — les bouchers halal saturent vite leur carnet de commandes pour l'Aïd. En 2026, Aïd al-Adha tombe en juin, réservez dès mai.",
    season: "summer",
    priority: "P0",
  },
  {
    slug: "mechoui",
    name: "Méchoui",
    keyword: "méchoui",
    // Pas de eventType : pas de date fixe → WebPage schema (Event sans
    // startDate refusé par GSC).
    shortDescription:
      "Commandez votre méchoui halal — agneau entier rôti, parfait pour mariages, événements familiaux et fêtes communautaires.",
    intro:
      "Le méchoui est l'art ancestral de cuire un agneau entier à la broche, souvent au feu de bois ou au charbon. Originaire d'Afrique du Nord, c'est l'un des plats festifs les plus prestigieux de la cuisine maghrébine et un incontournable des grandes occasions : mariages, baptêmes, anniversaires, fêtes communautaires, méchouis privés au bord du lac. Sur Klik&Go, les boucheries halal partenaires vous proposent des agneaux entiers halal certifiés, sélectionnés auprès d'éleveurs alpins (Bauges, Chartreuse, Forez), avec un poids garanti (12-18 kg pour un agneau standard, soit 20-30 personnes selon les accompagnements). Vous pouvez commander l'agneau seul (à cuire vous-même), avec service traiteur (le boucher le cuit pour vous), ou en pack complet (agneau + merguez + brochettes pour les invités plus difficiles). Comptez environ 500-700g de viande par adulte pour un méchoui festif.",
    servingTip: {
      question: "Combien d'agneau pour un méchoui de 30 personnes ?",
      answer:
        "Pour 30 personnes, comptez un agneau entier de 18-20 kg (avec os), accompagné de merguez (60-90 pièces) et de brochettes (30-50). Soit environ 500-700g de viande par adulte. Pour 50 personnes : 2 agneaux de 14-16 kg chacun.",
    },
    bookingDelay: "Délai de commande : minimum 5-7 jours avant l'événement (l'agneau entier doit être commandé chez l'éleveur).",
    season: "summer",
    priority: "P0",
  },
  {
    slug: "mariage",
    name: "Mariage",
    keyword: "viande mariage halal",
    // Pas de eventType : date personnelle, pas universelle → WebPage schema.
    shortDescription:
      "Commandez la viande halal de votre mariage : agneau, bœuf, volaille, méchoui, brochettes — packs sur mesure.",
    intro:
      "Le mariage musulman est l'une des plus grandes occasions de la vie : 100, 200, parfois 500 invités à régaler. La viande halal est le centre du repas — méchoui d'agneau, brochettes, kefta, couscous royal, tajines de poulet et d'agneau aux pruneaux. Sur Klik&Go, les boucheries halal partenaires vous accompagnent dans la préparation de votre mariage : devis sur mesure, packs négociés selon le nombre d'invités, livraison en plusieurs lots si besoin, possibilité de prestation traiteur (cuisson sur place). Commandez vos viandes 2 à 4 semaines avant la date, pour garantir l'approvisionnement en agneaux entiers et en pièces nobles. Toutes les viandes sont halal certifiées, issues d'élevages français sélectionnés.",
    servingTip: {
      question: "Combien de viande pour un mariage de 100 personnes ?",
      answer:
        "Pour un mariage de 100 personnes en buffet halal, comptez environ 60-70 kg de viande au total : 1 agneau entier (méchoui), 200 brochettes mixtes, 5 kg de kefta, 30 poulets fermiers, 10 kg de viande hachée pour boulettes. Soit 600-700g par adulte.",
    },
    bookingDelay: "Délai : 2 à 4 semaines avant la date du mariage. Devis personnalisé sous 48h.",
    season: "year-round",
    priority: "P0",
  },
  {
    slug: "ramadan",
    name: "Ramadan",
    keyword: "viande ramadan",
    eventType: "FoodEvent",
    // Ramadan 1448 AH = ~6 fév au 8 mars 2027 (Ramadan 2026 est passé).
    // Bumper chaque année après l'iftar du dernier jour.
    eventStart: "2027-02-06",
    eventEnd: "2027-03-08",
    shortDescription:
      "Commandez votre viande halal pour le Ramadan : packs iftar, suhour, repas familiaux. Click & collect pour briser le jeûne sans stress.",
    intro:
      "Le mois sacré du Ramadan est le moment où les familles musulmanes se retrouvent chaque soir pour rompre le jeûne (iftar) et préparent souvent un suhour copieux avant l'aube. La viande halal occupe une place centrale dans les repas du Ramadan : harira au bœuf, chorba, brochettes, méchoui le week-end, tajines lents, boulettes en sauce, pastilla aux fruits secs. Sur Klik&Go, les boucheries halal partenaires proposent des packs Ramadan adaptés à votre famille : packs iftar pour 4-6 personnes, packs suhour avec viande hachée et brochettes, packs week-end pour les grands repas. Vous pouvez aussi commander à la pièce. Click & collect possible : commandez l'après-midi, récupérez avant l'iftar, sans file d'attente. Frais de service : 0,99€ par commande.",
    servingTip: {
      question: "Quelle quantité de viande pour le Ramadan ?",
      answer:
        "Pour une famille de 5 personnes en Ramadan, comptez environ 4-5 kg de viande halal par semaine : 1 kg viande hachée (kefta, harira), 1.5 kg agneau (tajine, brochettes), 1 poulet entier, 500g merguez. Adaptez selon vos repas et invités.",
    },
    bookingDelay: "Commande possible jusqu'au jour même selon créneau. Pour les grands repas (>10 personnes), prévoir 24h.",
    season: "ramadan",
    priority: "P0",
  },
  {
    slug: "aqiqa",
    name: "Aqiqa",
    keyword: "viande aqiqa",
    // Pas de eventType : date dépend de la naissance, pas universelle → WebPage.
    shortDescription:
      "Commandez votre mouton halal pour l'aqiqa (naissance bébé) — sacrifice et préparation par votre boucher.",
    intro:
      "L'aqiqa est une tradition musulmane qui célèbre la naissance d'un enfant : le 7e jour après la naissance, les parents sacrifient un mouton (ou deux pour un garçon, un pour une fille selon certaines écoles), partagé entre la famille, les voisins et les nécessiteux. Sur Klik&Go, les boucheries halal partenaires vous accompagnent dans cette tradition : commande d'un mouton halal certifié (12-15 kg en moyenne), sacrifice rituel, découpe selon vos besoins (3 parts traditionnellement : famille, voisins, nécessiteux), conditionnement en barquettes ou sous vide. Vous pouvez aussi opter pour la cuisson partielle (méchoui pour la fête de famille) ou la préparation en plats (tajine, couscous). Délai recommandé : commander dès la naissance pour garantir la disponibilité.",
    servingTip: {
      question: "Quel poids de mouton pour une aqiqa ?",
      answer:
        "Un mouton standard pour aqiqa pèse 12-15 kg (vivant), soit environ 6-8 kg de viande nette après abattage. Suffit pour 15-20 parts si découpé en 3 (famille, voisins, dons). Pour un garçon (2 moutons), prévoyez le double.",
    },
    bookingDelay: "Délai : 3-5 jours minimum (l'éleveur doit préparer l'animal).",
    season: "year-round",
    priority: "P1",
  },
  {
    slug: "barbecue",
    name: "Barbecue halal",
    keyword: "barbecue halal",
    // Pas de eventType : catégorie de produit pas un événement → WebPage.
    shortDescription:
      "Pack barbecue halal — merguez, brochettes, côtes d'agneau, marinades — préparé par votre boucher pour vos grillades.",
    intro:
      "Le barbecue halal est la star de l'été en France : entre amis, en famille, au bord du lac d'Annecy ou dans le jardin, il rassemble. Sur Klik&Go, les boucheries halal partenaires préparent des packs barbecue clés en main pour 4, 6, 10, 15 ou 20 personnes : merguez maison, brochettes d'agneau marinées, côtes d'agneau, côtes de bœuf, ailes de poulet épicées, kefta sur brochettes. Vous pouvez aussi composer votre pack à la carte selon vos goûts et votre budget. Commander en ligne le matin et récupérer en sortant du travail = vous arrivez chez vous prêt à allumer le barbecue. Toutes les viandes sont halal certifiées, marinades maison, sans conservateurs ni colorants.",
    servingTip: {
      question: "Quelle quantité de viande pour un barbecue halal de 10 personnes ?",
      answer:
        "Pour 10 personnes (adultes), comptez environ 5-6 kg de viande au total : 30 merguez (3 par personne), 10 brochettes d'agneau, 10 brochettes de poulet, 10 côtes d'agneau, 1 kg de viande hachée pour quelques burgers. Soit ~600g par personne.",
    },
    bookingDelay: "Pour le week-end, commandez avant jeudi soir. Pour la semaine, créneau du jour possible.",
    season: "summer",
    priority: "P0",
  },
  {
    slug: "buffet",
    name: "Buffet halal",
    keyword: "buffet halal",
    // Pas de eventType : catégorie de produit pas un événement → WebPage.
    shortDescription:
      "Commandez votre buffet halal pour événements professionnels, anniversaires, baptêmes — pack viande complet.",
    intro:
      "Pour vos événements (anniversaire, baptême, fête de fin d'année, séminaire d'entreprise), Klik&Go vous propose des packs buffet halal sur mesure : assortiment de viandes pour brochettes, kefta sur baguette, mini-merguez en pic apéro, viande hachée pour mini-burgers, tartare halal pour les amateurs. Les boucheries halal partenaires préparent vos viandes la veille ou le jour même, conditionnées en barquettes individuelles ou en plateaux pour faciliter le service. Vous pouvez compléter avec des spécialités du boucher (samoussas, briouates, crêpes berbères) selon disponibilité. Devis sur mesure, livraison ou retrait en boutique au créneau choisi.",
    servingTip: {
      question: "Combien de viande pour un buffet halal de 20 personnes ?",
      answer:
        "Pour un buffet halal de 20 personnes (apéritif dinatoire), comptez environ 5 kg de viande variée : 40 mini-brochettes, 20 mini-merguez, 1.5 kg de kefta sur pic, 1 kg de viande hachée pour mini-burgers, 1 kg de poulet pané maison. Soit 250-300g par personne.",
    },
    bookingDelay: "Délai : 5-7 jours pour les buffets >30 personnes. 48h pour les petits buffets.",
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
