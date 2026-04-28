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
  {
    slug: "cognin",
    name: "Cognin",
    region: "Savoie",
    description:
      "Boucheries halal à Cognin (Savoie). Commandez votre viande halal en ligne et récupérez-la en boutique en click & collect, à 5 minutes du centre de Chambéry.",
    latitude: 45.5599,
    longitude: 5.8861,
  },
  {
    slug: "bissy",
    name: "Bissy",
    region: "Savoie",
    description:
      "Boucheries halal à Bissy (Chambéry). Trouvez votre boucher halal à Bissy et commandez en click & collect : viande halal fraîche, retrait rapide.",
    latitude: 45.5742,
    longitude: 5.8867,
  },
  {
    slug: "la-motte-servolex",
    name: "La Motte-Servolex",
    region: "Savoie",
    description:
      "Boucheries halal à La Motte-Servolex. Commandez votre viande halal en ligne avec retrait en boutique près de Chambéry.",
    latitude: 45.5933,
    longitude: 5.8761,
  },
  {
    slug: "villeurbanne",
    name: "Villeurbanne",
    region: "Rhône",
    description:
      "Boucheries halal à Villeurbanne. Commande en ligne et retrait en boutique pour votre viande halal fraîche dans le Grand Lyon.",
    latitude: 45.7665,
    longitude: 4.8795,
  },
  {
    slug: "venissieux",
    name: "Vénissieux",
    region: "Rhône",
    description:
      "Boucheries halal à Vénissieux. Commandez votre viande halal en click & collect et récupérez-la en boutique dans la métropole lyonnaise.",
    latitude: 45.6975,
    longitude: 4.8867,
  },
] as const;

export type SeoCity = (typeof SEO_CITIES)[number];
