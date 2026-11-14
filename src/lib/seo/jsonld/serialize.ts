// Sérialisation sûre des données structurées (JSON-LD) destinées à un <script>.
//
// JSON.stringify n'échappe pas « < » : un texte venu de la base (avis client,
// nom de boutique, de produit, titre de recette…) contenant « </script> »
// fermerait le bloc et exécuterait du script sur une page publique.
//
// Contrat :
// - retourne JSON.stringify(data) où « < », « > », « & », U+2028 et U+2029 sont
//   remplacés par leur échappement JSON \uXXXX. La sortie reste du JSON valide
//   qui se relit (JSON.parse) en une valeur identique, et ne peut jamais
//   contenir « </script », « <!-- » ni « ]]> » ;
// - retourne null quand JSON.stringify ne produit rien (undefined, fonction,
//   symbole) : il n'y a alors aucun bloc à émettre ;
// - laisse remonter les erreurs de JSON.stringify (référence circulaire, BigInt) :
//   ce sont des erreurs de programmation, pas des données à masquer.

const UNSAFE_CHARS = /[<>&\u2028\u2029]/g;

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export function serializeJsonLd(data: unknown): string | null {
  const json: string | undefined = JSON.stringify(data);
  if (json === undefined) return null;
  return json.replace(UNSAFE_CHARS, (char) => ESCAPES[char]);
}
