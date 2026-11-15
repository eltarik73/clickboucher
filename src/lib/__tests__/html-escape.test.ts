// @vitest-environment node
// Échappement HTML : la seule autorité pour tout document HTML écrit à la main (exports, e-mails,
// tickets). Un prénom saisi par un invité y devient du texte, jamais du balisage.
import { describe, expect, it } from "vitest";

import { escapeHtml, html, trustedHtml } from "@/lib/html/escape";

const ATTACK = "<img src=x onerror=alert(1)>";

describe("escapeHtml", () => {
  it.each([
    ["&", "&amp;"],
    ["<", "&lt;"],
    [">", "&gt;"],
    ['"', "&quot;"],
    ["'", "&#39;"],
  ])("%s devient %s", (raw, escaped) => {
    expect(escapeHtml(raw)).toBe(escaped);
  });

  it("échappe chaque caractère spécial d'un texte mêlé", () => {
    expect(escapeHtml(`Tom & "Jerry" <b>l'ami</b>`)).toBe(
      "Tom &amp; &quot;Jerry&quot; &lt;b&gt;l&#39;ami&lt;/b&gt;"
    );
  });

  it("un texte déjà échappé s'affiche tel qu'il a été tapé (& d'abord, sans double échappement)", () => {
    expect(escapeHtml("&lt;b&gt;")).toBe("&amp;lt;b&amp;gt;");
  });

  it("laisse les accents et les émojis intacts", () => {
    expect(escapeHtml("Zoé Aïcha, Chambéry 🥩 — D’Angelo")).toBe(
      "Zoé Aïcha, Chambéry 🥩 — D’Angelo"
    );
  });

  it("rend une attaque inerte", () => {
    expect(escapeHtml(ATTACK)).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("html``", () => {
  it("échappe une chaîne insérée dans le texte", () => {
    expect(html`<p>${ATTACK}</p>`.value).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
  });

  it("échappe un guillemet inséré dans un attribut : l'attribut ne peut pas être refermé", () => {
    const title = 'x" onmouseover="alert(1)';
    expect(html`<a title="${title}">lien</a>`.value).toBe(
      '<a title="x&quot; onmouseover=&quot;alert(1)">lien</a>'
    );
  });

  it("insère un html`` imbriqué tel quel, échappé une seule fois", () => {
    const name = html`<b>${"Zoé & Co"}</b>`;
    expect(html`<p>${name}</p>`.value).toBe("<p><b>Zoé &amp; Co</b></p>");
  });

  it("insère une liste de html`` sans séparateur, chaque élément échappé une seule fois", () => {
    const items = ["<a>", "b&c"].map((item) => html`<b>${item}</b>`);
    expect(html`<p>${items}</p>`.value).toBe("<p><b>&lt;a&gt;</b><b>b&amp;c</b></p>");
  });

  it("échappe chaque chaîne d'une liste", () => {
    expect(html`<p>${["<", "Zoé", ">"]}</p>`.value).toBe("<p>&lt;Zoé&gt;</p>");
  });

  it("imprime un nombre tel quel", () => {
    const amounts = html`<b>${1250}</b><b>${-3.5}</b><b>${0}</b>`;
    expect(amounts.value).toBe("<b>1250</b><b>-3.5</b><b>0</b>");
  });

  it.each([NaN, Infinity, -Infinity])("refuse le nombre %s (TypeError)", (value) => {
    expect(() => html`<td>${value}</td>`).toThrow(TypeError);
  });

  it("refuse une valeur hors du type venue d'un JSON (null, booléen, objet imitant SafeHtml)", () => {
    const absent = JSON.parse("null");
    const flag = JSON.parse("true");
    const forged = JSON.parse('{"value":"<script>alert(1)</script>"}');
    expect(() => html`<p>${absent}</p>`).toThrow(TypeError);
    expect(() => html`<p>${flag}</p>`).toThrow(TypeError);
    expect(() => html`<p>${forged}</p>`).toThrow(TypeError);
  });

  it("garde le texte écrit dans le gabarit tel quel", () => {
    expect(html`<p class="a">Total : 12,50 €</p>`.value).toBe('<p class="a">Total : 12,50 €</p>');
  });

  it("String() et toString() rendent la même chose que .value", () => {
    const fragment = html`<p>${"Léa <3"}</p>`;
    expect(String(fragment)).toBe("<p>Léa &lt;3</p>");
    expect(fragment.toString()).toBe(fragment.value);
  });
});

describe("trustedHtml", () => {
  it("insère un balisage constant sans l'échapper", () => {
    const logo = trustedHtml('<b style="color: #DC2626">Klik&amp;Go</b>');
    expect(html`<p>${logo}</p>`.value).toBe('<p><b style="color: #DC2626">Klik&amp;Go</b></p>');
  });
});
