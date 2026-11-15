// Reading a rendered page as a crawler does, for the seo-audit checks (src/lib/seo/audit-checks.ts):
// robots directives, title, canonical, JSON-LD and the page's own copy. Pure: HTML in, facts out.
//
// Only real markup counts: scripts (the React Server Components payload, JSON-LD), styles,
// templates and comments are not tags nor text. React separates text nodes with « <!-- --> », so
// comments are removed without a space.

export type JsonNode = Record<string, unknown>;

const ROBOTS_META_NAMES: ReadonlySet<string> = new Set(["robots", "googlebot", "bingbot"]);
// Agents of an X-Robots-Tag « agent: directives » group that apply to the engines we care about.
const ROBOTS_HEADER_AGENTS: ReadonlySet<string> = new Set(["googlebot", "bingbot"]);
// Directives written « name:value », which an X-Robots-Tag must not mistake for an agent.
const VALUED_DIRECTIVES: ReadonlySet<string> = new Set([
  "max-snippet",
  "max-image-preview",
  "max-video-preview",
  "unavailable_after",
]);
const DESCRIPTION_METAS: ReadonlySet<string> = new Set([
  "description",
  "og:description",
  "twitter:description",
]);

// A start tag's attribute source, quotes allowed to contain « > ».
const ATTRIBUTES = `((?:[^>"']|"[^"]*"|'[^']*')*)`;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const NON_CONTENT = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const SCRIPT = new RegExp(`<script\\b${ATTRIBUTES}>([\\s\\S]*?)<\\/script\\s*>`, "gi");
const ANCHOR = new RegExp(`<a\\b${ATTRIBUTES}>[\\s\\S]*?<\\/a\\s*>`, "gi");
const SHOP_HREF = /^(?:https?:\/\/[^/]+)?\/boutique(?:[/?#]|$)/i;
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export function decodeEntities(text: string): string {
  return text.replace(ENTITY, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (!lower.startsWith("#")) return NAMED_ENTITIES[lower] ?? entity;
    const point = lower.startsWith("#x")
      ? parseInt(lower.slice(2), 16)
      : parseInt(lower.slice(1), 10);
    return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function attributesOf(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const [, name, double, single, bare] of source.matchAll(ATTRIBUTE)) {
    attributes.set(name.toLowerCase(), decodeEntities(double ?? single ?? bare ?? ""));
  }
  return attributes;
}

/** The markup a browser treats as tags and text: no script, style, template or comment. */
function markupOf(html: string): string {
  return html.replace(NON_CONTENT, " ").replace(COMMENT, "");
}

function startTags(markup: string, tag: string): Map<string, string>[] {
  const pattern = new RegExp(`<${tag}\\b${ATTRIBUTES}>`, "gi");
  return [...markup.matchAll(pattern)].map((match) => attributesOf(match[1]));
}

function splitDirectives(value: string): string[] {
  return value
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .filter((directive) => directive !== "");
}

// « noindex, googlebot: nofollow, otherbot: noindex »: a leading « agent: » scopes the directives
// that follow it; only the generic ones and those for Googlebot or Bingbot are kept.
function headerDirectives(value: string): string[] {
  const kept: string[] = [];
  let agent: string | null = null;
  for (const token of splitDirectives(value)) {
    const scoped = /^([a-z0-9_-]+)\s*:\s*(.*)$/.exec(token);
    let directive = token;
    if (scoped !== null && !VALUED_DIRECTIVES.has(scoped[1])) {
      agent = scoped[1];
      directive = scoped[2];
    }
    if (directive !== "" && (agent === null || ROBOTS_HEADER_AGENTS.has(agent))) {
      kept.push(directive);
    }
  }
  return kept;
}

/**
 * Every directive of the robots, googlebot and bingbot metas (head and body, as Google reads a
 * streamed page) and of the X-Robots-Tag header. One noindex (or none) anywhere is enough.
 */
export function robotsVerdict(
  html: string,
  xRobotsTag: string | null
): { noindex: boolean; directives: string[] } {
  const directives: string[] = [];
  for (const meta of startTags(markupOf(html), "meta")) {
    const name = meta.get("name")?.toLowerCase();
    const content = meta.get("content");
    if (name !== undefined && content !== undefined && ROBOTS_META_NAMES.has(name)) {
      directives.push(...splitDirectives(content));
    }
  }
  if (xRobotsTag !== null) directives.push(...headerDirectives(xRobotsTag));
  return {
    noindex: directives.some((directive) => directive === "noindex" || directive === "none"),
    directives,
  };
}

/** The text of the first <title>, decoded and trimmed; empty when there is none. */
export function titleOf(html: string): string {
  const source = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(markupOf(html))?.[1];
  return source === undefined ? "" : decodeEntities(source).trim();
}

/** The href of the canonical link, or null when the page has none. */
export function canonicalOf(html: string): string | null {
  const link = startTags(markupOf(html), "link").find((attributes) =>
    (attributes.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")
  );
  return link?.get("href") ?? null;
}

/** Every application/ld+json block: the parsed values, and how many blocks are not JSON. */
export function readJsonLd(html: string): { values: unknown[]; invalid: number } {
  const values: unknown[] = [];
  let invalid = 0;
  for (const [, attributes, body] of html.matchAll(SCRIPT)) {
    if (attributesOf(attributes).get("type")?.toLowerCase() !== "application/ld+json") continue;
    try {
      values.push(JSON.parse(body));
    } catch {
      // An unparseable block is a defect of the page: counted here, reported by the checks.
      invalid += 1;
    }
  }
  return { values, invalid };
}

/** The parsed value of every JSON-LD block of the page, in order (unparseable blocks left out). */
export function extractJsonLd(html: string): unknown[] {
  return readJsonLd(html).values;
}

/** Every object of the JSON-LD values, nested ones included (an @graph, an ItemList item…). */
export function jsonLdNodes(value: unknown, nodes: JsonNode[] = []): JsonNode[] {
  if (Array.isArray(value)) {
    for (const item of value) jsonLdNodes(item, nodes);
  } else if (value !== null && typeof value === "object") {
    nodes.push(value as JsonNode);
    for (const item of Object.values(value)) jsonLdNodes(item, nodes);
  }
  return nodes;
}

/** « Store », « https://schema.org/Store » and « schema:Store » all give « Store ». */
export function typesOf(node: JsonNode): string[] {
  const type = node["@type"];
  return (Array.isArray(type) ? type : [type])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/^.*[/:#]/, ""));
}

// The text values of the JSON-LD, without identifiers and URLs.
function jsonLdText(value: unknown, strings: string[] = []): string[] {
  if (typeof value === "string") {
    if (!/^(?:https?:)?\/|^@/.test(value)) strings.push(value);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) jsonLdText(item, strings);
  }
  return strings;
}

/**
 * Klik&Go's own copy on the page, one part per line: the visible text without the shop cards
 * (links to /boutique/…, which show what each shop entered), the meta descriptions and the JSON-LD
 * text. Attributes are not copy (a class such as « scale-[0.99] » says nothing).
 */
export function ownCopyText(html: string, jsonLd: unknown[]): string {
  const markup = markupOf(html);
  const text = markup
    .replace(ANCHOR, (anchor, attributes: string) =>
      SHOP_HREF.test(attributesOf(attributes).get("href") ?? "") ? " " : anchor
    )
    .replace(/<[^>]*>/g, " ");
  const descriptions = startTags(markup, "meta")
    .filter((meta) =>
      DESCRIPTION_METAS.has((meta.get("name") ?? meta.get("property") ?? "").toLowerCase())
    )
    .map((meta) => meta.get("content") ?? "");
  return [decodeEntities(text), ...descriptions, ...jsonLdText(jsonLd)]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .join("\n");
}
