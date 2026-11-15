// src/lib/html/escape.ts — the one escaping rule of every HTML document written by hand (print
// exports, e-mails, kitchen tickets). React escapes what it renders; these documents are strings,
// so any text a person typed (a guest's name, an order note) is escaped here, or it becomes markup.
//
// `html` escapes every substitution by default. Markup reaches a document only as a SafeHtml, and
// a SafeHtml comes only from `html` (escaped substitutions) or `trustedHtml` (a literal written in
// the source, checked by src/lib/__tests__/html-sinks.test.ts).

/** The text as HTML text or attribute value: & < > " ' become &amp; &lt; &gt; &quot; &#39;. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let createSafeHtml: (markup: string) => SafeHtml;

/** Markup that is safe to insert as is: built by `html` or `trustedHtml`, never by a caller. */
export class SafeHtml {
  static {
    createSafeHtml = (markup) => new SafeHtml(markup);
  }

  // A private member makes the type nominal: an object literal with the same shape is not a SafeHtml.
  private constructor(private readonly markup: string) {}

  get value(): string {
    return this.markup;
  }

  toString(): string {
    return this.markup;
  }
}

export type HtmlValue = string | number | SafeHtml | readonly HtmlValue[];

function renderValue(value: HtmlValue): string {
  if (value instanceof SafeHtml) return value.value;
  if (typeof value === "string") return escapeHtml(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`html : ${value} n'est pas imprimable`);
    return String(value);
  }
  // Values typed `any` (JSON, untyped libraries) reach here unchecked by the compiler.
  if (!Array.isArray(value)) throw new TypeError(`html : valeur non imprimable (${typeof value})`);
  return value.map(renderValue).join("");
}

/**
 * Tagged template: every string or number substitution is escaped, SafeHtml is inserted as is,
 * arrays are joined without separator. A NaN or infinite number, or a value outside HtmlValue
 * (null, undefined, boolean, plain object), throws a TypeError: a document never prints them.
 */
export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  const markup = values.reduce<string>(
    (built, value, index) => built + renderValue(value) + strings[index + 1],
    strings[0]
  );
  return createSafeHtml(markup);
}

/** Constant markup written in the source (CSS block, logo). The argument must be a string literal: enforced by html-sinks.test.ts. */
export function trustedHtml(literal: string): SafeHtml {
  return createSafeHtml(literal);
}
