// @vitest-environment node
// Prénom et nom d'une personne, saisis à la commande invitée : une seule écriture (espaces
// retirés autour, espaces intérieurs réduits à un, forme Unicode NFC), puis lettres, espaces,
// apostrophes et tirets seulement, 50 caractères au plus.
import { describe, expect, it } from "vitest";

import { firstNameSchema, lastNameSchema, personNameSchema } from "@/lib/validators/person-name";

const MESSAGES = { required: "requis", invalid: "invalide" };
const schema = personNameSchema(MESSAGES);

const FIRST_NAME_INVALID =
  "Le prénom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)";
const LAST_NAME_INVALID =
  "Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)";

/** "Aïcha" compte 5 lettres : 10 fois = 50. */
const FIFTY_LETTERS = "Aïcha".repeat(10);
/** U+20BB7, caractère de noms japonais hors du plan de base : 2 unités UTF-16, 1 caractère. */
const OUTSIDE_BMP = "\u{20BB7}";

describe("personNameSchema : accepté et ramené à une seule écriture", () => {
  it.each([
    ["Zoé", "Zoé"],
    ["Aïcha", "Aïcha"],
    ["O'Brien", "O'Brien"],
    ["D’Angelo", "D’Angelo"],
    ["Jean-Pierre", "Jean-Pierre"],
    ["Ben  Saïd", "Ben Saïd"],
    [" Léa ", "Léa"],
    ["\tLéa\n", "Léa"],
    ["Marie   Anne  Lise", "Marie Anne Lise"],
    [FIFTY_LETTERS, FIFTY_LETTERS],
  ])("%j -> %j", (input, expected) => {
    expect(schema.parse(input)).toBe(expected);
  });

  it("recompose une lettre accentuée saisie en deux points de code (NFD -> NFC)", () => {
    // "e" + U+0301 (accent aigu combinant) devient U+00E9.
    expect(schema.parse("Zoé")).toBe("Zoé");
  });

  it("compte la longueur en caractères, pas en unités UTF-16 : 50 caractères hors du plan de base passent", () => {
    expect(schema.parse(OUTSIDE_BMP.repeat(50))).toBe(OUTSIDE_BMP.repeat(50));
  });
});

describe("personNameSchema : refusé avec le message « invalid »", () => {
  it.each([
    ["balisage", "<img src=x onerror=alert(1)>"],
    ["chiffres seuls", "12345"],
    ["chiffre dans le nom", "Ali2"],
    ["retour à la ligne intérieur", "Ali\nBaba"],
    ["espace sans chasse U+200B", "Ali​Baba"],
    ["espace sans chasse seul", "​"],
    ["inversion de sens U+202E", "Ali‮baba"],
    ["51 lettres", `${FIFTY_LETTERS}s`],
    ["51 caractères hors du plan de base", OUTSIDE_BMP.repeat(51)],
    ["commence par un tiret", "-Ali"],
    ["commence par une apostrophe", "'Ali"],
    ["émoji", "Ali 🥩"],
    ["ponctuation", "Ali; DROP"],
    ["esperluette", "Ali & Co"],
  ])("%s", (_case, input) => {
    expect(schema.safeParse(input).error?.issues).toEqual([
      expect.objectContaining({ message: MESSAGES.invalid }),
    ]);
  });

  it("une valeur qui n'est pas du texte", () => {
    expect(schema.safeParse(42).error?.issues).toEqual([
      expect.objectContaining({ message: MESSAGES.invalid }),
    ]);
  });
});

describe("personNameSchema : refusé avec le message « required »", () => {
  it.each([
    ["vide", ""],
    ["espaces seuls", "   "],
    ["absent", undefined],
  ])("%s", (_case, input) => {
    expect(schema.safeParse(input).error?.issues).toEqual([
      expect.objectContaining({ message: MESSAGES.required }),
    ]);
  });
});

describe("firstNameSchema et lastNameSchema : messages français", () => {
  it("prénom : requis, puis invalide", () => {
    expect(firstNameSchema.safeParse(" ").error?.issues).toEqual([
      expect.objectContaining({ message: "Prénom requis" }),
    ]);
    expect(firstNameSchema.safeParse("<b>Zoé</b>").error?.issues).toEqual([
      expect.objectContaining({ message: FIRST_NAME_INVALID }),
    ]);
  });

  it("nom : requis, puis invalide", () => {
    expect(lastNameSchema.safeParse("").error?.issues).toEqual([
      expect.objectContaining({ message: "Nom requis" }),
    ]);
    expect(lastNameSchema.safeParse("12345").error?.issues).toEqual([
      expect.objectContaining({ message: LAST_NAME_INVALID }),
    ]);
  });

  it("les deux acceptent un nom composé accentué", () => {
    expect(firstNameSchema.parse("Zoé-Aïcha")).toBe("Zoé-Aïcha");
    expect(lastNameSchema.parse("O'Brien")).toBe("O'Brien");
  });
});
