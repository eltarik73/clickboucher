// Claims Klik&Go must never make in a page, metadata, FAQ JSON-LD or llms.txt.
//
// Facts behind the rules: payment happens in the shop at pickup (no online payment, no service
// fee), the service is click and collect only (no delivery), each shop is responsible for its
// own halal certification, nothing is promised about preparation time, and no figure is
// published unless the page computes it. The honest sentences live in src/lib/seo/facts.ts.
//
// Every pattern is case-insensitive and Unicode-aware: word boundaries are written with
// \p{L} / \p{N} lookarounds because \b ignores accented letters, and \s also covers the
// non-breaking spaces French typography puts before « : », « € » and « % ».

export type ForbiddenClaim = { id: string; why: string; pattern: RegExp };

const FLAGS = "iu";
// Not preceded / followed by a letter (start and end of a word).
const START = "(?<![\\p{L}])";
const END = "(?![\\p{L}])";
// Past participle in every gender and number, with or without the accent.
const PARTICIPLE = "(?:[ée]es|[ée]s|[ée]e|[ée])";

function anyOf(...alternatives: string[]): RegExp {
  return new RegExp(alternatives.map((alternative) => `(?:${alternative})`).join("|"), FLAGS);
}

export const FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  {
    id: "fee-amount",
    why: "No service fee is charged for an order paid at pickup: never print a fee figure, say « sans frais de service ».",
    pattern: anyOf(
      "(?<![\\p{N}])0[.,]99(?![\\p{N}])",
      `${START}frais(?:\\s+de\\s+service)?\\s*(?:de\\s+|:\\s*)?\\d+(?:[.,]\\d+)?\\s?(?:€|euros?)`,
      "(?<![\\p{N}])\\d+(?:[.,]\\d+)?\\s?(?:€|euros?)\\s+de\\s+frais"
    ),
  },
  {
    id: "online-payment",
    why: "Payment happens in the shop at pickup: there is no online payment, no card payment on the site and no bank transfer.",
    pattern: anyOf(
      `${START}(?:pay(?:ez|er|ons|ant|ées|és|ée|é)|paiements?|r[éè]gl(?:ez|er|ements?|ées|és|ée|é))(?:\\s+(?:votre|vos|sa|ses|la|le|les)\\s+(?:commandes?|achats?|courses))?\\s+en\\s+ligne${END}`,
      `${START}paiements?\\s+s[ée]curis${PARTICIPLE}${END}`,
      `${START}stripe${END}`,
      `${START}virements?${END}`
    ),
  },
  {
    id: "delivery",
    why: "Click and collect only: « livraison », « livré », « livrer » may only appear directly negated (« pas de », « sans », « aucune », « ni »).",
    pattern: anyOf(
      `(?<!(?:^|[^\\p{L}])(?:pas\\s+de|sans|aucune|ni)\\s+)${START}livr(?:aisons?|ée?s?|er|ons|ez|ent|eurs?)${END}`
    ),
  },
  {
    id: "pickup-delay",
    why: "Nothing is promised about preparation time: say « au créneau choisi », never « 30 min » or « en moins de N minutes ».",
    pattern: anyOf(
      `${START}moins\\s+de\\s+\\d+\\s?min(?:utes?)?${END}`,
      `(?<![\\p{N}])\\d+\\s?min(?:utes?)?\\s+chrono${END}`,
      `${START}(?:pr[êe]te?s?|disponibles?|retir\\p{L}*|r[ée]cup[ée]r\\p{L}*)\\s+en\\s+\\d+\\s?min(?:utes?)?${END}`,
      // « 30 min » alone; not a cooking time (« 1h30 », « toutes les 30 minutes »,
      // « 30 minutes avant cuisson », « 30 min/kg »).
      `(?<![\\p{N}h:])(?<!toutes\\s+les\\s+)30\\s?min(?:utes?)?${END}(?!\\s+avant)(?!\\s*\\/)`
    ),
  },
  {
    id: "quote-catering",
    why: "Klik&Go takes orders from the shop's catalogue only: no quote, no catering service, no answer-time promise.",
    pattern: anyOf(
      `${START}devis${END}`,
      `${START}traiteurs?${END}`,
      "(?<![\\p{N}])48\\s?h(?:eures?)?(?![\\p{L}])"
    ),
  },
  {
    id: "certification",
    why: "Klik&Go certifies nothing: halal certification is each shop's responsibility.",
    pattern: anyOf(
      `${START}halal\\s+certifi${PARTICIPLE}${END}`,
      `${START}certifi${PARTICIPLE}\\s+halal${END}`,
      `${START}(?:boucheries?|bouchers?|viandes?|volailles?|agneaux|partenaires?|commerces?)\\s+certifi${PARTICIPLE}${END}`,
      `(?<![\\p{N}])100\\s?%\\s*halal${END}`
    ),
  },
  {
    id: "verification",
    why: "Klik&Go does not verify shops before listing them: never call them verified.",
    pattern: anyOf(
      `${START}(?:partenaires?|boucheries?|bouchers?|boutiques?|commerces?)\\s+(?:(?:est|sont)\\s+)?v[ée]rifi${PARTICIPLE}${END}`,
      `${START}v[ée]rifi${PARTICIPLE}\\s+(?:avant|par)${END}`
    ),
  },
  {
    id: "real-time",
    why: "Hours and stock are what each shop entered: nothing is updated in real time.",
    pattern: anyOf(`${START}temps[\\s-]+r[ée]el(?:le)?s?${END}`),
  },
  {
    id: "superlative",
    why: "No superlative and no figure the page does not compute (counts, rankings, community percentages).",
    pattern: anyOf(
      `${START}premi[èe]re?\\s+plateforme${END}`,
      `${START}plus\\s+de\\s+\\d[\\d\\s.]*\\s+(?:boucheries?|bouchers?|recettes?|villes?|clients?|commandes?|partenaires?)${END}`,
      `${START}les\\s+plus\\s+acti(?:fs|f|ves|ve)${END}`,
      `${START}meilleur(?:es|e|s)?${END}`,
      `${START}des\\s+centaines\\s+de\\s+(?:boucheries?|bouchers?|clients?)${END}`,
      `(?<![\\p{N}])\\d+(?:[.,]\\d+)?\\s?%\\s+(?:de\\s+(?:la\\s+)?)?(?:population|habitants|musulman\\p{L}*|communaut\\p{L}*)`,
      `${START}(?:n[°º]\\s?1(?![\\p{N}])|num[ée]ro\\s+(?:1|un)${END}|leader${END})`
    ),
  },
  {
    id: "partner-count",
    why: "No count of registered shops: the number changes and the pages do not compute it.",
    pattern: anyOf(
      `${START}d[ée]j[àa]\\s+(?:inscrit(?:es|e|s)?|partenaires?|r[ée]f[ée]renc${PARTICIPLE})${END}`
    ),
  },
];

const GLOBAL_PATTERNS = FORBIDDEN_CLAIMS.map((claim) => ({
  id: claim.id,
  pattern: new RegExp(claim.pattern.source, `${claim.pattern.flags}g`),
}));

/**
 * Every forbidden claim found in the text, in the order of FORBIDDEN_CLAIMS and then of
 * appearance, with the exact matched text. An empty list means the text is clean.
 */
export function findForbiddenClaims(text: string): { id: string; match: string }[] {
  const found: { id: string; match: string }[] = [];
  for (const { id, pattern } of GLOBAL_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      found.push({ id, match: match[0] });
    }
  }
  return found;
}
