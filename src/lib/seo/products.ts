/**
 * Editorial data of the product x city pages (/produits/[produit]/[ville]):
 * 12 products x PRODUCT_VILLE_PRIORITY_SLUGS.
 *
 * Every text here is rendered whatever the shops of the city sell, so it must
 * stay true with zero shop: it explains the product, its cuts, quantities and
 * cooking, never what a listed shop makes or sources, and never a fee, a
 * payment mode, a delivery or a halal-compliance claim (wording rules D6 of chantier
 * C1-SEO, pinned by src/lib/__tests__/seo/seo-data.test.ts). What a shop
 * really sells is shown by the page from the database.
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
  /** Unique editorial paragraph about the product (true with zero shop) */
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
      "Merguez halal : agneau, bœuf ou mélange, harissa et épices, combien en prévoir par personne et comment la cuire au barbecue, à la plancha ou au four.",
    intro:
      "La merguez est l'une des saucisses emblématiques de la cuisine maghrébine. Elle se prépare avec de la viande hachée d'agneau, de bœuf ou un mélange des deux, assaisonnée de harissa, d'ail, de cumin, de coriandre et de paprika, qui lui donnent sa couleur rouge et son goût relevé. Traditionnellement, elle est embossée dans un boyau de mouton, fin et naturel, qui la rend croquante à la cuisson. Chaque boucher a sa recette : plus ou moins piquante, plus ou moins parfumée au cumin, plus ou moins grasse. La merguez se prête à tout : barbecue d'été, couscous, sandwich, plat du soir avec des frites ou de la semoule. Pour un repas principal, comptez 4 à 6 merguez par adulte. À l'achat, regardez la couleur et le grain de la viande, et demandez au boucher quelle viande il utilise et à quel point sa recette est relevée.",
    cookingTips:
      "Cuisez vos merguez à feu moyen 6 à 8 minutes au barbecue ou à la plancha, en les retournant souvent. Au four, comptez 15 à 20 minutes à 200 °C. À la friteuse à air, 10 à 12 minutes à 180 °C en les retournant à mi-cuisson.",
    servingQuestion: {
      question: "Combien de merguez par personne pour un barbecue ?",
      answer:
        "Comptez 4 à 6 merguez par adulte pour un repas principal, 2 à 3 si elles accompagnent des brochettes ou des côtes d'agneau. Pour un méchoui ou un grand repas, prévoyez plutôt 3 à 4 merguez par adulte en plus des autres viandes.",
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
      "Merguez maison : ce qui la distingue d'une merguez industrielle, comment la reconnaître à l'étal et comment la cuire sans la dessécher.",
    intro:
      "La merguez maison est préparée à la main par le boucher, à partir de viande hachée d'agneau, de bœuf ou d'un mélange des deux, et de son propre dosage d'épices : harissa, cumin, coriandre, ail, parfois menthe séchée. C'est ce qui la distingue de la merguez industrielle, dont la recette est standardisée. Chaque boucher a sa signature : certaines merguez maison sont très relevées, d'autres plus douces et plus parfumées. Préparée en petites quantités, elle se conserve peu de temps : cuisinez-la dans les jours qui suivent l'achat, ou congelez-la le jour même. Pour la reconnaître, regardez le boyau, fin et naturel, et la viande, dont le grain reste visible. N'hésitez pas à demander au boucher s'il la fabrique lui-même et avec quelle viande : c'est ainsi que l'on trouve la recette qui nous plaît.",
    cookingTips:
      "La merguez maison est souvent plus tendre et plus juteuse : surveillez-la, elle cuit vite. Comptez 5 à 7 minutes au barbecue, 12 à 15 minutes au four à 180 °C. Ne la piquez pas avec une fourchette, elle perdrait son jus.",
    servingQuestion: {
      question: "Comment reconnaître une vraie merguez maison ?",
      answer:
        "Une merguez maison se reconnaît à son boyau fin et naturel, à sa couleur rouge irrégulière où l'on voit le grain de la viande et à son odeur d'épices fraîches. Le plus simple reste de demander au boucher s'il la fabrique lui-même.",
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
      "Agneau halal : gigot, côtes, épaule, collier, souris… quel morceau choisir pour le four, le barbecue, le tajine ou le couscous, et combien en prévoir.",
    intro:
      "L'agneau est la viande des grandes occasions dans les cuisines du Maghreb et de la Méditerranée, et la viande de référence de l'Aïd al-Adha. Chaque morceau a son usage. Le gigot, charnu et tendre, se rôtit entier au four ou se cuit sept heures à basse température. Les côtes, taillées dans le carré ou dans le filet, se grillent en quelques minutes. L'épaule, plus persillée, supporte les cuissons longues et donne des tajines fondants ; le collier et la poitrine parfument les couscous et les ragoûts ; la souris, le bas du gigot, se confit au four. Pour choisir, regardez la couleur de la viande, rose clair chez l'agneau jeune, et la graisse, blanche et ferme. Demandez au boucher l'origine de l'agneau et faites-vous conseiller le morceau selon la recette et le nombre de convives ; il peut aussi désosser, ficeler ou couper la viande en cubes pour le tajine.",
    cookingTips:
      "Gigot au four : 12 à 15 minutes par 500 g à 180 °C pour une cuisson rosée. Côtes au barbecue : 3 à 4 minutes par face. Épaule en tajine : au moins 1 h 30 à feu doux. Sortez la viande du réfrigérateur une demi-heure avant la cuisson.",
    servingQuestion: {
      question: "Combien d'agneau halal par personne ?",
      answer:
        "Pour un gigot avec os, comptez 300 à 400 g par adulte. Pour des côtes : 3 à 4 côtes par adulte. Pour un tajine ou un couscous : 200 g de viande désossée par personne. Pour un méchoui : 500 à 700 g d'agneau avec os par personne.",
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
      "Gigot d'agneau halal : quel poids pour combien de convives, cuisson rosée ou de sept heures, et conseils pour le faire désosser et ficeler.",
    intro:
      "Le gigot d'agneau est la pièce des repas de famille du week-end et des fêtes, de l'Aïd al-Fitr à l'Aïd al-Adha. C'est la cuisse arrière de l'agneau : une viande charnue et tendre, qui se prête aussi bien à une cuisson rosée qu'à une cuisson très lente, à la cuillère. Un gigot entier pèse le plus souvent entre 1,8 et 2,5 kg avec l'os, de quoi servir 5 à 8 personnes selon sa taille. On peut aussi demander un demi-gigot, côté souris ou côté selle, ou un gigot raccourci. Faites-le désosser et ficeler si vous voulez une découpe facile à table, ou gardez-le entier si vous aimez la viande cuite sur l'os, plus moelleuse. Avant la cuisson, piquez-le de gousses d'ail et frottez-le d'huile d'olive, de romarin ou de cumin ; à la sortie du four, laissez-le reposer dix à quinze minutes sous une feuille d'aluminium avant de le trancher.",
    cookingTips:
      "Cuisson rosée : 12 à 15 minutes par 500 g à 180 °C, viande sortie du réfrigérateur une heure avant. Gigot de sept heures : 100 à 110 °C pendant 7 heures, pour une viande qui se défait à la cuillère. Frottez d'ail, de romarin et d'huile d'olive avant la cuisson.",
    servingQuestion: {
      question: "Quelle taille de gigot d'agneau pour 6 personnes ?",
      answer:
        "Pour 6 adultes, comptez un gigot de 2 à 2,5 kg avec l'os. Pour 8 personnes, prévoyez 2,8 à 3 kg. La règle : 300 à 400 g de viande avec os par personne.",
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
      "Côtes d'agneau halal : premières, secondes, découvertes ou filet, ce qui les distingue, combien en prévoir et comment les griller à point.",
    intro:
      "Les côtes d'agneau se grillent en quelques minutes et plaisent à toute la famille, au barbecue comme à la plancha. Toutes n'ont pas le même usage. Les côtes premières et secondes, taillées dans le carré, ont une belle noix de viande et un long os : elles sont prisées pour la grillade. Les côtes découvertes, plus près du cou, sont plus grasses et moins chères ; elles se grillent aussi, ou se mijotent. Les côtes filet, coupées dans la selle, sont épaisses et charnues. Le carré entier, rôti au four puis découpé à table, fait une belle pièce de fête. Comptez 3 à 4 côtes par adulte en plat principal. Pour une grillade réussie, demandez des côtes d'épaisseur régulière, autour de 1,5 cm, et retirez l'excès de gras pour éviter les flammes au barbecue.",
    cookingTips:
      "Au barbecue : 3 à 4 minutes par face à feu vif. À la poêle : huilez la viande plutôt que la poêle, 2 à 3 minutes par face. Sortez les côtes du réfrigérateur une demi-heure avant et salez-les après la cuisson pour garder leur jus.",
    servingQuestion: {
      question: "Combien de côtes d'agneau par personne ?",
      answer:
        "Comptez 3 à 4 côtes par adulte pour un repas principal, avec des légumes ou de la semoule. Pour un grand appétit ou un repas sans entrée, prévoyez 5 côtes par personne.",
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
      "Bœuf halal : entrecôte, bavette, rumsteck, paleron, joue… quel morceau choisir pour griller, poêler ou mijoter, et comment le cuire.",
    intro:
      "Le bœuf halal se décline en morceaux très différents selon la cuisson. Pour le grill et la poêle, on choisit les pièces tendres : entrecôte et faux-filet, persillés et goûteux ; rumsteck, pour des pavés plus maigres ; bavette et onglet, à la fibre longue, à saisir vivement et à servir saignants. Pour les plats mijotés, place aux morceaux riches en collagène, qui deviennent fondants après plusieurs heures : paleron et macreuse pour le bourguignon ou le tajine, joue pour la cocotte, jarret et plat de côtes pour le pot-au-feu, queue pour les bouillons. Le bœuf se vend aussi haché, en steaks ou à la demande, et en abats : langue, foie, cœur. Pour un plat mijoté, prévoyez un peu plus de viande par personne que pour une pièce à griller, car elle réduit à la cuisson. Demandez au boucher l'origine et la race de l'animal, et faites-vous conseiller le morceau selon votre recette.",
    cookingTips:
      "Entrecôte : 3 minutes par face à feu vif pour une cuisson saignante. Bourguignon : 3 heures à feu doux. Sortez toujours la viande du réfrigérateur une demi-heure avant la cuisson.",
    priority: "P1",
  },
  {
    slug: "viande-hachee-halal",
    name: "Viande hachée halal",
    category: "minced",
    keyword: "viande hachée halal",
    pluralKeyword: "viandes hachées halal",
    shortDescription:
      "Viande hachée halal : bœuf, agneau ou mélange, taux de matière grasse selon la recette, quantités par personne et conseils de conservation.",
    intro:
      "La viande hachée est la base de nombreux plats du quotidien : kefta, boulettes en sauce, hachis parmentier, sauce bolognaise, lasagnes, burgers maison. Le choix se fait en deux temps. D'abord l'espèce : bœuf pour la plupart des recettes, agneau pour les plats orientaux, mélange agneau-bœuf pour une kefta plus parfumée. Ensuite le taux de matière grasse : 5 % pour une viande maigre, 15 ou 20 % pour plus de moelleux dans les boulettes et les burgers. Chez le boucher, la viande peut être hachée à la demande, à partir de morceaux comme le paleron, le jumeau ou le gîte : c'est l'occasion de choisir précisément votre mélange. La viande hachée est un produit fragile : gardez-la au réfrigérateur, cuisinez-la de préférence le jour même et cuisez-la à cœur pour les jeunes enfants.",
    cookingTips:
      "Pour les keftas et les boulettes : ajoutez oignon haché, ail, persil, cumin et coriandre. Cuisson : 8 à 10 minutes à la poêle ou 15 minutes au four à 180 °C.",
    servingQuestion: {
      question: "Combien de viande hachée halal par personne ?",
      answer:
        "Pour un plat principal : 150 à 200 g par adulte. Pour des keftas en accompagnement : 100 g par personne.",
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
      "Kefta halal : viande hachée de bœuf ou d'agneau aux épices, en boulettes, en brochettes ou en sauce tomate, avec les temps de cuisson.",
    intro:
      "La kefta, ou kafta, est une préparation de viande hachée typique des cuisines du Maghreb et du Proche-Orient. On la fait avec du bœuf, de l'agneau ou un mélange des deux, relevé d'oignon, de persil, de coriandre, de cumin, de paprika et parfois de ras-el-hanout. Elle se façonne en boulettes, à mijoter dans une sauce tomate avec des œufs pour le tajine de kefta, ou en boudins serrés autour d'une brochette pour le barbecue. Pour une kefta qui se tient à la cuisson, choisissez une viande pas trop maigre, autour de 15 % de matière grasse, et laissez reposer le mélange une heure au frais avant de le façonner. Certains bouchers vendent la kefta déjà assaisonnée, en farce ou montée sur brochettes ; sinon, demandez une viande hachée agneau-bœuf et assaisonnez-la vous-même.",
    cookingTips:
      "Boulettes en sauce tomate : 25 minutes à feu doux. Brochettes au barbecue : 3 à 4 minutes par face. À la poêle : 8 minutes en remuant.",
    priority: "P1",
  },
  {
    slug: "brochettes-halal",
    name: "Brochettes halal",
    category: "mixed",
    keyword: "brochettes halal",
    pluralKeyword: "brochettes halal",
    shortDescription:
      "Brochettes halal d'agneau, de poulet ou de bœuf : marinades classiques, nombre de brochettes par personne et cuisson au barbecue ou à la plancha.",
    intro:
      "Les brochettes sont un incontournable des grillades d'été et des repas de fête. L'agneau (épaule ou gigot en cubes) donne des brochettes savoureuses, le poulet (blanc ou haut de cuisse) des brochettes tendres et rapides, le bœuf (rumsteck ou faux-filet) des brochettes à cuire rosées. La marinade fait la différence : yaourt, ail et épices pour le chich taouk, cumin, paprika et oignon pour un goût oriental, huile d'olive, citron et herbes pour une version méditerranéenne, harissa pour relever. Laissez mariner au moins deux heures au frais, idéalement une nuit pour l'agneau et le bœuf. Côté format, les mini-brochettes conviennent à l'apéritif, les brochettes de 80 à 100 g au repas principal. Coupez des morceaux de taille égale pour une cuisson homogène, et intercalez si vous le souhaitez poivron et oignon.",
    cookingTips:
      "Au barbecue : 3 à 4 minutes par face à feu vif, soit 8 à 12 minutes au total. À la plancha : feu moyen-vif, retournez toutes les 2 minutes. Au four : 20 minutes à 200 °C en retournant à mi-cuisson.",
    servingQuestion: {
      question: "Combien de brochettes halal par personne ?",
      answer:
        "Pour un repas principal : 2 à 3 brochettes par adulte, selon leur taille. Pour un apéritif dînatoire : 4 à 5 mini-brochettes par personne.",
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
      "Poulet halal : entier, escalopes, cuisses, pilons ou ailes, quel morceau pour quelle recette, combien par personne et temps de cuisson.",
    intro:
      "Le poulet est une viande du quotidien : rapide à cuisiner, apprécié des enfants, il se prête à toutes les cuisines. Le poulet entier se rôtit au four ou se cuit en cocotte, et sa carcasse donne un bon bouillon. Les escalopes, taillées dans le blanc, se poêlent en quelques minutes ou se panent. Les cuisses et les hauts de cuisse, plus moelleux, supportent bien le four et les tajines aux olives et au citron confit. Les pilons et les ailes, faciles à manger avec les doigts, se marinent pour le barbecue ou l'apéritif. Il existe aussi plusieurs qualités de poulet, du poulet standard au poulet fermier élevé en plein air, plus long à élever et plus ferme. Pour bien choisir, regardez la peau, qui doit être nette et sans taches, et demandez au boucher l'origine et le mode d'élevage du poulet.",
    cookingTips:
      "Poulet entier : 1 h 15 à 180 °C pour 1,4 kg, en l'arrosant régulièrement. Escalopes : 6 à 8 minutes à la poêle. Cuisses : 35 à 40 minutes au four à 200 °C.",
    servingQuestion: {
      question: "Combien de poulet halal par personne ?",
      answer:
        "Poulet entier : un poulet de 1,2 à 1,5 kg pour 4 personnes. Escalopes : une escalope de 150 g par personne. Cuisses : une cuisse par personne (200 à 250 g).",
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
      "Poulet fermier halal : ce que signifie la mention « fermier – élevé en plein air », la différence avec un poulet standard et le temps de cuisson.",
    intro:
      "La mention « fermier – élevé en plein air » est encadrée par la réglementation européenne : les poulets ont accès à un parcours extérieur et sont abattus à 81 jours au minimum, contre environ 35 à 40 jours pour un poulet standard. Le Label Rouge fermier ajoute un cahier des charges contrôlé sur l'alimentation, la souche et la densité d'élevage. Cette croissance plus lente donne une chair plus ferme et plus goûteuse, qui demande un peu plus de temps de cuisson. Un poulet peut être à la fois fermier et halal : la mention fermier concerne l'élevage, le rite halal concerne l'abattage. Pour savoir ce que vous achetez, demandez au boucher l'étiquette du poulet, qui indique son origine et son mode d'élevage. Rôti entier, le poulet fermier se suffit à lui-même ; ses restes et sa carcasse font de très bons bouillons et tajines.",
    cookingTips:
      "Le poulet fermier demande 15 à 20 % de temps de cuisson en plus qu'un poulet standard. Pour 1,8 kg : 1 h 45 à 180 °C, en l'arrosant toutes les demi-heures.",
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
      "Viande pour couscous halal : collier d'agneau, jarret de bœuf, merguez, poulet… les morceaux à associer et les quantités pour 4 à 12 personnes.",
    intro:
      "Le couscous se prépare traditionnellement avec plusieurs viandes, qui apportent chacune leur goût au bouillon : le collier ou l'épaule d'agneau pour le moelleux, le jarret de bœuf pour une sauce riche, le poulet ou la pintade pour la légèreté, les merguez grillées à part pour le piquant. Chaque région a sa version : couscous algérois, couscous marocain aux sept légumes, couscous tunisien relevé à la harissa, couscous royal qui réunit toutes les viandes. Pour les quantités, comptez environ 300 g de viande avec os par personne, merguez comprises : 1,2 kg pour 4 personnes, 2,4 kg pour 8 et 3,6 kg pour 12. Demandez au boucher de couper l'agneau et le bœuf en morceaux de taille égale, pour qu'ils cuisent au même rythme. Les morceaux avec os, comme le collier et le jarret, donnent du goût au bouillon : ne les remplacez pas tous par de la viande désossée.",
    cookingTips:
      "Comptez au moins 1 h 30 à feu doux pour que la viande soit tendre. Grillez les merguez à part ou ajoutez-les au bouillon un quart d'heure avant la fin. Ajoutez les légumes selon leur temps de cuisson : carottes et navets d'abord, courgettes à la fin.",
    servingQuestion: {
      question: "Combien de viande pour un couscous pour 8 personnes ?",
      answer:
        "Comptez environ 2,4 kg de viande avec os pour 8 personnes : 600 g de collier ou d'épaule d'agneau, 500 g de jarret de bœuf, 8 merguez (environ 500 g) et 8 pilons de poulet (environ 800 g).",
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
