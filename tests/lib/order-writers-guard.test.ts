// @vitest-environment node
// Garde statique : qui écrit dans la table orders après sa création.
//
// Depuis le chantier 0, `Order.status` n'est écrit que par src/lib/services/orders/transition.ts
// (mise à jour conditionnelle + OrderEvent dans la même transaction). Ce test parcourt src/ et
// relève chaque appel `order.update(` / `order.updateMany(` sur un client Prisma ou de transaction.
// Un nouvel écrivain fait échouer le test : il faut l'ajouter à la liste ci-dessous, avec sa raison,
// en connaissance de cause — et s'il écrit le statut, passer par transitionOrder à la place.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");

/** Fichiers autorisés à appeler order.update / order.updateMany, chacun avec sa raison. */
const ORDER_WRITERS: Record<string, string> = {
  "src/lib/services/orders/transition.ts":
    "seul écrivain du statut (transitionOrder / transitionOrderInTx)",
  "src/lib/services/orders/adjustment-settlement.ts":
    "seul écrivain d'un total ajusté : mise à jour conditionnelle (boutique, statut, total d'origine) sous verrou de ligne",
  "src/lib/notifications.ts": "journal notifSent des notifications envoyées",
  "src/app/api/orders/[id]/scheduled-notify/route.ts":
    "journal notifSent du rappel de commande programmée",
  "src/lib/services/orders/commands/progress.ts":
    "actions boucher sans changement de statut (délai, note), sous verrou de ligne",
  "src/lib/services/orders/commands/rate.ts": "note du client sur une commande terminée",
  "src/app/api/payments/webhook/route.ts":
    "webhook Stripe, paiement en ligne inactif (hors périmètre)",
  "src/lib/services/stripe/checkout-session.ts":
    "ventilation des frais Stripe, paiement en ligne inactif (hors périmètre)",
};

/** Seuls fichiers dont un appel écrit `status` dans `data`. */
const STATUS_WRITERS = [
  "src/app/api/payments/webhook/route.ts",
  "src/lib/services/orders/transition.ts",
];

/**
 * Appels dont `data` n'est pas un objet littéral : la garde ne peut pas le lire, le type doit
 * exclure `status`. Chaque entrée dit pourquoi le statut ne peut pas y figurer.
 */
const OPAQUE_DATA_WRITERS: Record<string, string> = {
  "src/lib/services/orders/commands/progress.ts":
    'compute() est typé Omit<Prisma.OrderUncheckedUpdateManyInput, "status">',
  "src/lib/services/orders/commands/rate.ts": "ratingData = { rating, ratingComment }",
};

// ── Lecture du code ──────────────────────────

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Le texte avec commentaires et contenus de chaînes remplacés par des espaces (même longueur),
 * pour que parenthèses, accolades et mots-clés ne soient lus que dans le code.
 */
function codeOnly(text: string): string {
  const out = text.split("");
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'" || c === "`") {
      // Une chaîne simple s'arrête à la fin de ligne : une apostrophe de texte JSX (« n'est »)
      // ne masque ainsi jamais plus que le reste de sa ligne.
      let j = i + 1;
      while (j < text.length && text[j] !== c && (c === "`" || text[j] !== "\n")) {
        j += text[j] === "\\" ? 2 : 1;
      }
      blank(i + 1, j);
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out.join("");
}

const OPENERS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Index juste après le délimiteur fermant qui correspond à celui en `start`. */
function closingIndex(code: string, start: number): number {
  const stack: string[] = [];
  for (let i = start; i < code.length; i += 1) {
    const c = code[i];
    if (c in OPENERS) stack.push(OPENERS[c]);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== c) throw new Error(`Délimiteurs déséquilibrés à l'index ${i}`);
      if (stack.length === 0) return i + 1;
    }
  }
  throw new Error(`Délimiteur non fermé à l'index ${start}`);
}

/** Valeur de la propriété `data` au premier niveau de l'objet passé à l'appel, ou null. */
function dataArgument(call: string): string | null {
  const objectStart = call.indexOf("{");
  if (objectStart === -1) return null;
  const objectEnd = closingIndex(call, objectStart);
  const body = call.slice(objectStart + 1, objectEnd - 1);
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c in OPENERS) depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (
      depth === 0 &&
      /\bdata\s*:/y.test(body.slice(i)) &&
      (i === 0 || /[\s,{]/.test(body[i - 1]))
    ) {
      let valueStart = body.indexOf(":", i) + 1;
      while (/\s/.test(body[valueStart])) valueStart += 1;
      let valueEnd = valueStart;
      let valueDepth = 0;
      while (valueEnd < body.length) {
        const v = body[valueEnd];
        if (v in OPENERS) valueDepth += 1;
        else if (v === ")" || v === "]" || v === "}") valueDepth -= 1;
        else if (v === "," && valueDepth === 0) break;
        valueEnd += 1;
      }
      return body.slice(valueStart, valueEnd).trim();
    }
  }
  return null;
}

interface OrderWrite {
  file: string;
  data: string | null;
}

const ORDER_WRITE_CALL = /\border\s*\.\s*(?:update|updateMany)\s*\(/g;

function orderWrites(): OrderWrite[] {
  return sourceFiles(SRC).flatMap((full) => {
    const code = codeOnly(readFileSync(full, "utf8"));
    const file = path.relative(ROOT, full).split(path.sep).join("/");
    return [...code.matchAll(ORDER_WRITE_CALL)].map((match) => {
      const open = (match.index ?? 0) + match[0].length - 1;
      return { file, data: dataArgument(code.slice(open, closingIndex(code, open))) };
    });
  });
}

const writesStatus = (data: string) => /\bstatus\b\s*(?::|,|\})/.test(data);
const isLiteral = (data: string) => data.startsWith("{");

// ── Garde ────────────────────────────────────

describe("écrivains de la table orders", () => {
  const writes = orderWrites();

  it("seuls les fichiers listés appellent order.update / order.updateMany", () => {
    const files = [...new Set(writes.map((write) => write.file))].sort();
    expect(files).toEqual(Object.keys(ORDER_WRITERS).sort());
  });

  it("seuls transition.ts et le webhook Stripe écrivent le statut", () => {
    const statusFiles = [
      ...new Set(writes.filter((w) => w.data !== null && writesStatus(w.data)).map((w) => w.file)),
    ].sort();
    expect(statusFiles).toEqual([...STATUS_WRITERS].sort());
  });

  it("chaque appel passe un `data` lisible, sauf les écrivains opaques justifiés", () => {
    const opaque = [
      ...new Set(writes.filter((w) => w.data === null || !isLiteral(w.data)).map((w) => w.file)),
    ].sort();
    expect(opaque).toEqual(Object.keys(OPAQUE_DATA_WRITERS).sort());
  });

  it("la lecture du code reconnaît une écriture de statut", () => {
    const call = codeOnly(
      'prisma.order.update({ where: { id, status: "PENDING" }, // status: "X"\n data: { note: "status: y", status: "READY" } })'
    );
    const open = call.indexOf("(");
    const data = dataArgument(call.slice(open, closingIndex(call, open)));
    expect(data).not.toBeNull();
    expect(writesStatus(data as string)).toBe(true);
    const guarded = codeOnly(
      'tx.order.updateMany({ where: { status: "COMPLETED" }, data: { rating: 5 } })'
    );
    const guardedOpen = guarded.indexOf("(");
    expect(
      writesStatus(
        dataArgument(guarded.slice(guardedOpen, closingIndex(guarded, guardedOpen))) as string
      )
    ).toBe(false);
  });
});
