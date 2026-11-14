import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";

// Seul fichier autorisé à écrire du JSON dans une balise <script>
// (verrouillé par src/lib/__tests__/json-ld.test.ts). Le contenu passe toujours
// par serializeJsonLd, qui échappe « < », « > », « & », U+2028 et U+2029.
// Rien n'est rendu si les données ne sont pas sérialisables (ex. undefined).
export function JsonLd({ data, id }: { data: unknown; id?: string }) {
  const json = serializeJsonLd(data);
  if (json === null) return null;
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
