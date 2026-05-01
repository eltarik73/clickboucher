/**
 * SEO products config — produits halal pour les pages produit×ville.
 * Combinés avec SEO_CITIES → ~120-180 pages SSG selon priorité.
 *
 * Chaque produit = mot-clé cible + intro éditoriale (250+ mots).
 * Les pages utilisent ce config + les boutiques DB qui vendent le produit.
 */

export type SeoProduct = {
  slug: string;
  /** Affichage : "Merguez maison" */
  name: string;
  /** Catégorie (Schema.org) : "Beef", "Lamb", "Poultry", "Charcuterie", "Mixed" */
  category: "lamb" | "beef" | "poultry" | "minced" | "charcuterie" | "mixed";
  /** Mot-clé principal pour title/H1 */
  keyword: string;
  /** Plural si nécessaire pour le contenu */
  pluralKeyword: string;
  /** 1 phrase courte pour metadescription dynamique */
  shortDescription: string;
  /** Paragraphe éditorial unique 200+ mots (E-E-A-T) */
  intro: string;
  /** Conseils cuisson (pour FAQ schema) */
  cookingTips?: string;
  /** Question fréquente type "combien de X par personne" */
  servingQuestion?: { question: string; answer: string };
  /** Niveau de priorité SEO (P0/P1/P2) */
  priority: "P0" | "P1" | "P2";
};

export const SEO_PRODUCTS: readonly SeoProduct[] = [
  // ── AGNEAU ──
  {
    slug: "merguez-halal",
    name: "Merguez halal",
    category: "mixed",
    keyword: "merguez halal",
    pluralKeyword: "merguez halal",
    shortDescription:
      "Merguez halal artisanale — agneau et bœuf, harissa, herbes — fraîchement préparée par votre boucher.",
    intro:
      "La merguez halal est l'une des saucisses les plus emblématiques de la cuisine maghrébine. Préparée traditionnellement à partir d'un mélange d'agneau et de bœuf haché, elle est assaisonnée de harissa, d'ail, de cumin, de coriandre et de paprika qui lui donnent sa couleur rouge caractéristique et son goût relevé. Sur Klik&Go, les boucheries halal partenaires fabriquent leur merguez maison chaque jour, en sélectionnant des viandes halal certifiées. Vous pouvez commander vos merguez en ligne pour le déjeuner du dimanche, un barbecue d'été, un couscous, ou simplement un repas familial. Le calibre standard est de 8 à 10 cm de long pour 2 cm de diamètre, soit environ 60 à 80 grammes par pièce. Comptez 4 à 6 merguez par personne pour un repas principal accompagné de pain ou de semoule.",
    cookingTips:
      "Cuisez vos merguez à feu moyen 6-8 minutes au barbecue ou à la plancha en les retournant souvent. Au four, comptez 15-20 minutes à 200°C. Pour la friteuse à air (airfryer), 10-12 minutes à 180°C en les retournant à mi-cuisson.",
    servingQuestion: {
      question: "Combien de merguez par personne pour un barbecue ?",
      answer:
        "Comptez 4 à 6 merguez par adulte pour un repas principal, 2 à 3 si elles sont servies en accompagnement de brochettes ou côtes d'agneau. Pour un méchoui ou un grand repas, prévoyez plutôt 3-4 merguez par adulte en plus des autres viandes.",
    },
    priority: "P0",
  },
  {
    slug: "merguez-maison",
    name: "Merguez maison",
    category: "mixed",
    keyword: "merguez maison",
    pluralKeyword: "merguez maison",
    shortDescription:
      "Merguez maison fabriquée chaque jour par votre boucher halal — recette traditionnelle agneau-bœuf et épices.",
    intro:
      "La merguez maison est la spécialité que tout amateur de barbecue recherche : préparée à la main par le boucher, à partir de viandes halal sélectionnées, elle a un goût incomparable avec la merguez industrielle. Les boucheries halal partenaires Klik&Go préparent leur merguez chaque matin, en utilisant un boyau naturel et un mélange précis d'agneau, de bœuf et d'épices (harissa, cumin, coriandre, ail). Chaque boucher a sa propre recette : certains plus piquants, d'autres plus parfumés au cumin. Commander des merguez maison en ligne vous garantit la fraîcheur du jour, sans congélation ni conservateurs.",
    cookingTips:
      "La merguez maison est plus tendre et juteuse — soyez vigilant : elle cuit plus vite que l'industrielle. 5-7 minutes au barbecue, 12-15 minutes au four à 180°C. Ne la piquez pas avec une fourchette pour éviter qu'elle perde son jus.",
    servingQuestion: {
      question: "Comment reconnaître une vraie merguez maison ?",
      answer:
        "Une merguez maison se reconnaît à son boyau fin et naturel, sa couleur rouge non uniforme (vraie viande hachée visible), son odeur d'épices fraîches, et son prix légèrement plus élevé que les merguez industrielles. Sur Klik&Go, toutes les merguez sont produites artisanalement par les bouchers partenaires.",
    },
    priority: "P0",
  },
  {
    slug: "agneau-halal",
    name: "Agneau halal",
    category: "lamb",
    keyword: "agneau halal",
    pluralKeyword: "morceaux d'agneau halal",
    shortDescription:
      "Agneau halal certifié — gigot, côtes, épaule, collier — issu d'élevages français et alpins.",
    intro:
      "L'agneau halal est l'une des viandes les plus consommées dans la cuisine musulmane et méditerranéenne. Sur Klik&Go, les boucheries halal partenaires sélectionnent leur agneau auprès d'éleveurs français — Bauges, Forez, Pilat, Aravis, Sud-Lyonnais, Beaufortain — pour vous garantir une viande halal certifiée, fraîche et tracée. Vous trouvez tous les morceaux : gigot pour le four, côtes premières pour le barbecue, épaule pour le tajine, collier pour le couscous, jarret pour le ragoût. L'agneau halal est aussi la viande de référence pour l'Aïd al-Adha, le Ramadan et tous les grands repas familiaux.",
    cookingTips:
      "Gigot au four : 30 min/kg à 180°C pour une cuisson rosée. Côtes au barbecue : 3-4 minutes par face. Épaule en tajine : 1h30 minimum à feu doux. Sortez la viande 30 minutes avant cuisson.",
    servingQuestion: {
      question: "Combien d'agneau halal par personne ?",
      answer:
        "Pour un gigot : 250-300g par adulte (avec os). Pour des côtes : 3-4 côtes par adulte. Pour un tajine ou couscous : 200g de viande désossée par personne. Pour un méchoui : 500-700g d'agneau entier par personne.",
    },
    priority: "P0",
  },
  {
    slug: "gigot-agneau-halal",
    name: "Gigot d'agneau halal",
    category: "lamb",
    keyword: "gigot d'agneau halal",
    pluralKeyword: "gigots d'agneau halal",
    shortDescription:
      "Gigot d'agneau halal frais — viande tendre pour le four, idéal pour les repas familiaux et fêtes.",
    intro:
      "Le gigot d'agneau halal est l'un des morceaux les plus appréciés pour les repas familiaux du dimanche, les fêtes religieuses (Aïd al-Fitr, Aïd al-Adha) et les grandes occasions. C'est la pièce noble du gigot d'agneau, charnue et tendre, idéale pour une cuisson lente au four. Sur Klik&Go, les boucheries halal partenaires sélectionnent leurs gigots auprès d'élevages français — agneaux des Alpes, des Bauges, du Pilat — pour vous garantir une viande halal certifiée, fraîche, jamais congelée. Vous pouvez commander un gigot entier (1.8-2.5 kg en moyenne, pour 6-8 personnes), une demi-pièce, ou faire désosser et ficeler par votre boucher pour faciliter la cuisson et la découpe.",
    cookingTips:
      "Cuisson rosée : 25-30 min/kg à 180°C (sortez la viande 1h avant). Cuisson 7 heures à basse température : 100-110°C pendant 7h pour une viande qui se défait à la fourchette. Frottez avec ail, romarin, huile d'olive avant cuisson.",
    servingQuestion: {
      question: "Quelle taille de gigot d'agneau pour 6 personnes ?",
      answer:
        "Pour 6 personnes adultes, comptez un gigot d'agneau de 2 à 2,5 kg (avec os). Pour 8 personnes, prévoyez 2,8 à 3 kg. Compter 300-400g de viande avec os par personne.",
    },
    priority: "P0",
  },
  {
    slug: "cote-agneau-halal",
    name: "Côte d'agneau halal",
    category: "lamb",
    keyword: "côte d'agneau halal",
    pluralKeyword: "côtes d'agneau halal",
    shortDescription:
      "Côte d'agneau halal — premières, secondes, découvertes — viande tendre pour grillade et plancha.",
    intro:
      "Les côtes d'agneau halal sont l'une des pièces les plus appréciées pour les grillades, le barbecue et la plancha. Tendres, savoureuses, rapides à cuire, elles plaisent à toute la famille. On distingue trois types : les côtes premières (les plus tendres, rosées et juteuses), les côtes secondes (tout aussi savoureuses), et les côtes découvertes (plus économiques, idéales pour les ragoûts). Sur Klik&Go, vos boucheries halal partenaires sélectionnent leurs agneaux français pour vous garantir des côtes halal certifiées, fraîches et tracées.",
    cookingTips:
      "Au barbecue : 3-4 minutes par face à feu vif. À la poêle : huilez la viande, pas la poêle, 2-3 minutes par face. Sortez les côtes 30 minutes avant cuisson. Salez après cuisson pour préserver le jus.",
    servingQuestion: {
      question: "Combien de côtes d'agneau par personne ?",
      answer:
        "Comptez 3 à 4 côtes par adulte pour un repas principal, accompagnées de légumes ou de semoule. Pour un grand mangeur ou un repas sans entrée, prévoyez 5 côtes par personne.",
    },
    priority: "P1",
  },
  // ── BOEUF ──
  {
    slug: "boeuf-halal",
    name: "Bœuf halal",
    category: "beef",
    keyword: "bœuf halal",
    pluralKeyword: "morceaux de bœuf halal",
    shortDescription:
      "Bœuf halal certifié — entrecôte, bavette, rumsteck, bourguignon — issu d'élevages français.",
    intro:
      "Le bœuf halal proposé par les boucheries partenaires Klik&Go provient d'élevages français — Charolais du Beaujolais, races à viande des Bauges et du Bugey — abattus selon les rites halal certifiés. Vous trouvez toutes les pièces : entrecôte et faux-filet pour le grill, bavette d'aloyau et onglet pour la poêle, rumsteck pour les pavés, paleron pour le bourguignon, joue pour la mijoteuse, queue pour le pot-au-feu. Le bœuf halal est aussi disponible en viande hachée fraîche, en steaks hachés, et en pièces spéciales pour les recettes familiales (osso buco, jarret, langue, foie).",
    cookingTips:
      "Entrecôte : 3 minutes par face à feu vif pour une cuisson saignante. Bourguignon : 3h à feu doux. Sortez toujours la viande 30 minutes avant cuisson.",
    priority: "P1",
  },
  {
    slug: "viande-hachee-halal",
    name: "Viande hachée halal",
    category: "minced",
    keyword: "viande hachée halal",
    pluralKeyword: "viandes hachées halal",
    shortDescription:
      "Viande hachée halal fraîche du jour — bœuf 5%, agneau, mélange — préparée par votre boucher.",
    intro:
      "La viande hachée halal est un incontournable de la cuisine quotidienne : kefta, hachis parmentier, boulettes en sauce, sauce bolognaise, kebab maison, burgers. Les boucheries halal partenaires Klik&Go préparent leur viande hachée à la commande, à partir de pièces nobles (paleron, jumeau, gîte) sélectionnées dans le matin. Vous choisissez votre taux de matière grasse (5% pour les régimes, 15% pour le goût), votre type (bœuf pur, agneau pur, mélange agneau-bœuf pour les keftas) et votre quantité. Pas de viande pré-emballée standardisée : c'est de la viande hachée du jour, garantie fraîche.",
    cookingTips:
      "Pour les keftas et boulettes : ajoutez oignon haché, ail, persil, cumin, coriandre. Cuisson : 8-10 minutes à la poêle ou 15 minutes au four à 180°C.",
    servingQuestion: {
      question: "Combien de viande hachée halal par personne ?",
      answer: "Pour un plat principal : 150-200g par adulte. Pour des keftas en accompagnement : 100g par personne.",
    },
    priority: "P0",
  },
  {
    slug: "kefta-halal",
    name: "Kefta halal",
    category: "minced",
    keyword: "kefta halal",
    pluralKeyword: "keftas halal",
    shortDescription:
      "Kefta halal préparée par votre boucher — boulettes de viande hachée à l'orientale, prêtes à cuisiner.",
    intro:
      "La kefta (ou kafta) est une boulette de viande hachée typique de la cuisine maghrébine et orientale. Préparée à base de viande hachée halal (bœuf, agneau, ou mélange), elle est aromatisée avec oignon, persil, coriandre, cumin, paprika et parfois ras-el-hanout. Les boucheries halal partenaires Klik&Go préparent leur kefta artisanalement chaque jour, prête à cuisiner ou à embrocher pour les chiches kebabs. Vous pouvez la commander en boulettes formées, en farce non roulée pour vos propres préparations, ou montée sur brochettes pour le barbecue.",
    cookingTips:
      "Boulettes en sauce tomate : 25 minutes à feu doux. Brochettes au barbecue : 3-4 minutes par face. À la poêle : 8 minutes en remuant.",
    priority: "P1",
  },
  {
    slug: "brochettes-halal",
    name: "Brochettes halal",
    category: "mixed",
    keyword: "brochettes halal",
    pluralKeyword: "brochettes halal",
    shortDescription:
      "Brochettes halal — agneau, poulet, bœuf — marinées par votre boucher pour barbecue et plancha.",
    intro:
      "Les brochettes halal sont l'incontournable du barbecue d'été et des grillades familiales. Sur Klik&Go, les boucheries halal partenaires préparent vos brochettes à la commande : choisissez votre viande (agneau, poulet, bœuf, mixte), votre marinade (chichi taouk au yaourt, chiche kebab à l'orientale, méditerranéenne aux herbes, harissa pour relever), et votre format (mini-brochettes apéro, brochettes standard 80-100g, méga-brochettes 150g). Toutes nos brochettes sont préparées le jour même, avec viande halal certifiée et marinade maison.",
    cookingTips:
      "Au barbecue : 3-4 minutes par face à feu vif (8-12 min total). À la plancha : feu moyen-vif, retourner toutes les 2 minutes. Au four : 20 minutes à 200°C en retournant à mi-cuisson.",
    servingQuestion: {
      question: "Combien de brochettes halal par personne ?",
      answer:
        "Pour un repas principal : 2 à 3 brochettes par adulte (selon taille). Pour un apéro dinatoire : 4-5 mini-brochettes par personne.",
    },
    priority: "P0",
  },
  // ── POULET / VOLAILLE ──
  {
    slug: "poulet-halal",
    name: "Poulet halal",
    category: "poultry",
    keyword: "poulet halal",
    pluralKeyword: "poulets halal",
    shortDescription:
      "Poulet halal frais — poulet entier, escalopes, cuisses, ailes — issu d'élevages fermiers français.",
    intro:
      "Le poulet halal est la viande de volaille la plus consommée. Sur Klik&Go, les boucheries halal partenaires sélectionnent leur poulet auprès d'élevages fermiers français — Dombes, Bresse, Beaujolais — pour vous garantir une volaille halal certifiée, élevée en plein air, sans antibiotiques préventifs. Vous trouvez tous les morceaux : poulet entier (idéal pour le four ou la cocotte-minute), escalopes (pour la poêle), cuisses (pour le rôti), pilons (pour les enfants), ailes (pour l'apéro), magrets de canard.",
    cookingTips:
      "Poulet entier : 1h15 à 180°C pour 1.4 kg, arrosez régulièrement. Escalopes : 6-8 minutes à la poêle. Cuisses : 35-40 minutes au four à 200°C.",
    servingQuestion: {
      question: "Combien de poulet halal par personne ?",
      answer:
        "Poulet entier : 1 poulet de 1,2-1,5 kg pour 4 personnes. Escalopes : 1 escalope de 150g par personne. Cuisses : 1 cuisse par personne (200-250g).",
    },
    priority: "P0",
  },
  {
    slug: "poulet-fermier-halal",
    name: "Poulet fermier halal",
    category: "poultry",
    keyword: "poulet fermier halal",
    pluralKeyword: "poulets fermiers halal",
    shortDescription:
      "Poulet fermier halal élevé en plein air — viande savoureuse et tracée, pour les amateurs de qualité.",
    intro:
      "Le poulet fermier halal est issu d'élevages traditionnels où les animaux sont élevés en plein air, nourris au grain, et abattus à un âge plus avancé que les poulets industriels (12 semaines minimum vs 5-6 semaines). Le résultat : une viande plus ferme, plus parfumée, avec une chair jaune typique d'un poulet bien nourri. Sur Klik&Go, les boucheries halal partenaires sélectionnent leurs poulets fermiers auprès d'élevages des Dombes et de Bresse, certifiés halal. Comptez environ 30% plus cher qu'un poulet standard mais une qualité gustative incomparable.",
    cookingTips:
      "Le poulet fermier nécessite 15-20% plus de temps de cuisson qu'un poulet standard. Pour 1,8 kg : 1h45 à 180°C, en arrosant toutes les 30 minutes.",
    priority: "P1",
  },
  // ── CHARCUTERIE ──
  {
    slug: "viande-pour-couscous",
    name: "Viande pour couscous",
    category: "mixed",
    keyword: "viande pour couscous halal",
    pluralKeyword: "viandes pour couscous halal",
    shortDescription:
      "Pack viande pour couscous — collier d'agneau, jarret, merguez, poulet — préparé par votre boucher.",
    intro:
      "La viande pour couscous halal est traditionnellement un mélange de plusieurs morceaux qui apportent leurs saveurs : collier d'agneau (pour le moelleux), jarret de bœuf (pour la sauce), merguez (pour le piquant), poulet ou pintade (pour la légèreté). Sur Klik&Go, les boucheries halal partenaires proposent des packs couscous prêts à cuisiner, avec les bonnes proportions pour 4, 6, 8 ou 12 personnes. Vous pouvez aussi composer votre pack à la carte selon vos préférences : couscous algérois, marocain, tunisien, ou royal.",
    cookingTips:
      "Cuisson : 1h30 minimum à feu doux pour que la viande soit tendre. Ajoutez les merguez en fin de cuisson (15 min). Préparez les légumes (carottes, courgettes, navets, pois chiches) à part.",
    servingQuestion: {
      question: "Combien de viande pour un couscous pour 8 personnes ?",
      answer:
        "Comptez environ 1,5 kg de viande au total pour 8 personnes : 600g de collier ou jarret d'agneau, 400g de jarret de bœuf, 8 merguez, 8 morceaux de poulet (ou 1 pintade entière).",
    },
    priority: "P0",
  },
];

/** Cities prioritaires pour les pages produit×ville (Sprint 5) */
export const PRODUCT_VILLE_PRIORITY_SLUGS = [
  "lyon",
  "grenoble",
  "saint-etienne",
  "chambery",
  "annecy",
  "villeurbanne",
  "venissieux",
] as const;

/** Helper : retourne tous les couples produit×ville pour SSG */
export function getProductCityCombinations(): Array<{ produit: string; ville: string }> {
  const combos: Array<{ produit: string; ville: string }> = [];
  for (const product of SEO_PRODUCTS) {
    for (const ville of PRODUCT_VILLE_PRIORITY_SLUGS) {
      combos.push({ produit: product.slug, ville });
    }
  }
  return combos;
}
