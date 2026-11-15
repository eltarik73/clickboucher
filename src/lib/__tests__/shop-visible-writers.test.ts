// @vitest-environment node
// Garde statique : qui écrit la publication d'une boutique (C1-FAILLES-CRITIQUES, D9).
//
// Shop.visible (« en liste »), suspendedAt, suspendReason et validatedAt ne s'écrivent que dans
// les fichiers listés ci-dessous : l'administration (services/shops/moderation.ts), les congés du
// boucher (shop-vacation.ts) et les deux créations de boutique, qui naissent hors liste. Avant ce
// chantier, le boucher se republiait lui-même (onboarding setVisible, fin de congés) et une
// boutique suspendue revenait en ligne.
//
// Le test lit src/ avec le compilateur TypeScript : chaque appel `<client>.shop.<écriture>(…)`
// (prisma ou transaction) et chaque texte SQL qui fait UPDATE / INSERT sur "shops". Les clés de
// `data` sont lues dans l'objet littéral, ses décompositions (`...(cond && { … })`) et les
// constantes `as const` du même fichier. Un `data` illisible (sortie d'un schéma Zod, objet
// construit) doit figurer dans OPAQUE_SHOP_WRITERS avec sa raison.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

const PUBLICATION_COLUMNS = ["visible", "suspendedAt", "suspendReason", "validatedAt"];
const PUBLICATION_SQL_COLUMNS = /\b(visible|suspended_at|suspend_reason|validated_at)\b/i;
const SQL_SHOP_WRITE = /\b(UPDATE|INSERT\s+INTO)\s+"?shops\b/i;
const SQL = "(sql)";

/** Seuls fichiers qui écrivent une colonne de publication, chacun avec sa raison. */
const PUBLICATION_WRITERS: Record<string, string> = {
  "src/lib/services/shops/moderation.ts":
    "décisions de l'administration : valider, publier, retirer, suspendre, réactiver",
  "src/lib/shop-vacation.ts":
    "congés du boucher, écriture conditionnelle : seule une boutique en liste et non suspendue",
  "src/app/api/onboarding/route.ts": "création à l'inscription : hors liste jusqu'à la validation",
  "src/app/api/shops/register/route.ts":
    "création à l'inscription boucher : hors liste jusqu'à la validation",
};

/** Écritures de boutique dont `data` ne se lit pas ici : pourquoi la publication n'y est pas. */
const OPAQUE_SHOP_WRITERS: Record<string, string> = {
  "src/lib/services/shops/moderation.ts": "decision.data : décisions écrites dans ce même fichier",
  "src/app/api/shops/[id]/route.ts":
    "sortie de ownerShopUpdateSchema / updateShopSchema (.strict, sans champ de plateforme)",
  "src/lib/services/shops/owner-write.ts":
    "écritures du propriétaire : leur type interdit les colonnes de publication (never)",
};

const WRITE_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);
const DATA_PROPERTIES: Record<string, string[]> = { upsert: ["create", "update"] };

/** Colonnes écrites par un appel (SQL brut : « (sql) »), ou null quand son `data` ne se lit pas. */
type ShopWrite = { file: string; columns: string[] | null };
type Constants = Map<string, ts.Expression>;

// ── Lecture du code ──────────────────────────

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** `{ … } as const`, éventuellement `satisfies T` : un objet que rien ne complète ensuite. */
function isConstObject(node: ts.Expression): boolean {
  let current = node;
  while (ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return (
    ts.isAsExpression(current) &&
    current.type.getText() === "const" &&
    ts.isObjectLiteralExpression(unwrap(current.expression))
  );
}

function constObjects(source: ts.SourceFile): Constants {
  const found: Constants = new Map();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
      isConstObject(node.initializer)
    ) {
      found.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function union(parts: Array<string[] | null>): string[] | null {
  const known = parts.filter((part): part is string[] => part !== null);
  return known.length === parts.length ? known.flat() : null;
}

function writtenKeys(node: ts.Expression, constants: Constants): string[] | null {
  const value = unwrap(node);
  if (ts.isIdentifier(value)) {
    const constant = constants.get(value.text);
    return constant ? writtenKeys(constant, constants) : null;
  }
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return writtenKeys(value.right, constants);
  }
  if (ts.isConditionalExpression(value)) {
    return union([writtenKeys(value.whenTrue, constants), writtenKeys(value.whenFalse, constants)]);
  }
  if (ts.isArrayLiteralExpression(value)) {
    return union(value.elements.map((element) => writtenKeys(element, constants)));
  }
  if (!ts.isObjectLiteralExpression(value)) return null;
  return union(
    value.properties.map((property) => {
      if (ts.isSpreadAssignment(property)) return writtenKeys(property.expression, constants);
      const name = property.name;
      return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? [name.text] : null;
    })
  );
}

/** Clés écrites par `<client>.shop.<method>(args)` : `data`, ou `create` et `update` d'un upsert. */
function callColumns(call: ts.CallExpression, method: string, constants: Constants) {
  const argument = call.arguments[0] && unwrap(call.arguments[0]);
  if (!argument || !ts.isObjectLiteralExpression(argument)) return null;
  const wanted = DATA_PROPERTIES[method] ?? ["data"];
  return union(
    argument.properties.flatMap((property) => {
      if (ts.isShorthandPropertyAssignment(property)) {
        return wanted.includes(property.name.text) ? [writtenKeys(property.name, constants)] : [];
      }
      if (ts.isSpreadAssignment(property)) return [null];
      const named = ts.isPropertyAssignment(property) && ts.isIdentifier(property.name);
      return named && wanted.includes(property.name.text)
        ? [writtenKeys(property.initializer, constants)]
        : [];
    })
  );
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ");
  }
  return null;
}

function shopWrites(file: string, text: string): ShopWrite[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = constObjects(source);
  const writes: ShopWrite[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const { expression: model, name: method } = node.expression;
      if (
        WRITE_METHODS.has(method.text) &&
        ts.isPropertyAccessExpression(model) &&
        model.name.text === "shop"
      ) {
        writes.push({ file, columns: callColumns(node, method.text, constants) });
      }
    }
    const sql = literalText(node);
    if (sql !== null && SQL_SHOP_WRITE.test(sql) && PUBLICATION_SQL_COLUMNS.test(sql)) {
      writes.push({ file, columns: [SQL] });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return writes;
}

function allShopWrites(): ShopWrite[] {
  return sourceFiles(SRC).flatMap((full) =>
    shopWrites(path.relative(ROOT, full).split(path.sep).join("/"), readFileSync(full, "utf8"))
  );
}

const writesPublication = (write: ShopWrite) =>
  write.columns?.some((column) => column === SQL || PUBLICATION_COLUMNS.includes(column)) ?? false;

const filesOf = (writes: ShopWrite[]) => [...new Set(writes.map((write) => write.file))].sort();

// ── Garde ────────────────────────────────────

describe("écrivains de la publication d'une boutique", () => {
  const writes = allShopWrites();

  it("seuls les fichiers listés écrivent visible, suspendedAt, suspendReason ou validatedAt", () => {
    expect(filesOf(writes.filter(writesPublication))).toEqual(
      Object.keys(PUBLICATION_WRITERS).sort()
    );
  });

  it("chaque écriture de boutique au `data` illisible est listée avec sa raison", () => {
    expect(filesOf(writes.filter((write) => write.columns === null))).toEqual(
      Object.keys(OPAQUE_SHOP_WRITERS).sort()
    );
  });
});

describe("lecture du code par la garde", () => {
  const columnsOf = (code: string) => shopWrites("exemple.ts", code).map((write) => write.columns);

  it("lit l'objet littéral, ses décompositions conditionnelles et les constantes as const", () => {
    const code = `
      const LISTED = { visible: true, status: "OPEN" } as const satisfies Prisma.ShopUpdateInput;
      await tx.shop.updateMany({ where: { id }, data: { ...LISTED, note: "x" } });
      await prisma.shop.update({ where: { id }, data: { ...(flag && { suspendedAt: now }) } });
      await prisma.shop.upsert({ where: { id }, create: { name }, update: { validatedAt: now } });
      await prisma.product.update({ where: { id }, data: { visible: true } });`;
    expect(columnsOf(code)).toEqual([
      ["visible", "status", "note"],
      ["suspendedAt"],
      ["name", "validatedAt"],
    ]);
  });

  it("déclare illisible un data qui n'est pas un objet figé du fichier", () => {
    const code = `
      const draft: Record<string, unknown> = {};
      draft.visible = true;
      await prisma.shop.update({ where: { id }, data: draft });
      await prisma.shop.update({ where: { id }, data });
      await tx.shop.updateMany({ ...query });`;
    expect(columnsOf(code)).toEqual([null, null, null]);
  });

  it("repère le SQL brut qui écrit une colonne de publication de shops", () => {
    const code = `
      await tx.$executeRaw\`UPDATE "shops" SET "visible" = true WHERE "id" = \${id}\`;
      await tx.$executeRaw\`UPDATE "shops" SET "rating" = 5 WHERE "id" = \${id}\`;
      await prisma.$executeRawUnsafe('UPDATE shops SET suspended_at = NULL');`;
    expect(columnsOf(code)).toEqual([[SQL], [SQL]]);
  });
});
