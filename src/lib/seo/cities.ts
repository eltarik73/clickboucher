export const SEO_CITIES = [
  {
    slug: "chambery",
    name: "Chambéry",
    region: "Savoie",
    description:
      "Découvrez les boucheries halal de Chambéry et commandez en click & collect. Viande fraîche halal, retrait rapide en boutique dans toute la Savoie.",
    latitude: 45.5646,
    longitude: 5.9178,
  },
  {
    slug: "aix-les-bains",
    name: "Aix-les-Bains",
    region: "Savoie",
    description:
      "Commandez votre viande halal en ligne à Aix-les-Bains. Boucheries halal partenaires en Savoie, retrait en boutique rapide et pratique.",
    latitude: 45.6884,
    longitude: 5.9153,
  },
  {
    slug: "grenoble",
    name: "Grenoble",
    region: "Isère",
    description:
      "Commandez votre viande halal en ligne à Grenoble. Les meilleures boucheries halal de Grenoble et de l'agglomération grenobloise en click & collect.",
    latitude: 45.1885,
    longitude: 5.7245,
  },
  {
    slug: "lyon",
    name: "Lyon",
    region: "Rhône",
    description:
      "Boucheries halal à Lyon : commandez en ligne et récupérez en boutique. Click & collect dans tout le Grand Lyon, Villeurbanne, Vénissieux, Vaulx-en-Velin.",
    latitude: 45.764,
    longitude: 4.8357,
  },
  {
    slug: "saint-etienne",
    name: "Saint-Étienne",
    region: "Loire",
    description:
      "Trouvez votre boucherie halal à Saint-Étienne. Commande en ligne, retrait en boutique. Viande halal fraîche et de qualité dans la Loire.",
    latitude: 45.4397,
    longitude: 4.3872,
  },
  {
    slug: "annecy",
    name: "Annecy",
    region: "Haute-Savoie",
    description:
      "Boucheries halal à Annecy et en Haute-Savoie. Commandez en ligne et récupérez votre viande halal fraîche en boutique.",
    latitude: 45.8992,
    longitude: 6.1294,
  },
] as const;

export type SeoCity = (typeof SEO_CITIES)[number];
