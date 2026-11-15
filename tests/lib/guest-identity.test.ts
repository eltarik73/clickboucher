// @vitest-environment node
// Identité d'une commande invitée (C1-INVITES) : e-mail normalisé, téléphone ramené à une seule
// écriture (E.164) pour que le plafond de commandes en attente compare des valeurs égales, et
// adresse du client lue dans les en-têtes posés par la plateforme.
import { describe, expect, it } from "vitest";

import {
  clientIp,
  guestIdentitySchema,
  normalizeGuestPhone,
} from "@/app/api/checkout/guest/identity";

const PHONE_MESSAGE = "Téléphone invalide (ex. 06 12 34 56 78)";
const FIRST_NAME_INVALID =
  "Le prénom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)";
const LAST_NAME_INVALID =
  "Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)";

describe("normalizeGuestPhone", () => {
  it.each(["06 12 34 56 78", "06.12.34.56.78", "0612345678", "+33 6 12 34 56 78", "0033612345678"])(
    "%s -> +33612345678",
    (raw) => {
      expect(normalizeGuestPhone(raw)).toBe("+33612345678");
    }
  );

  it("garde un numéro étranger déjà international", () => {
    expect(normalizeGuestPhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("retire tirets, parenthèses et espaces insécables", () => {
    expect(normalizeGuestPhone("(06)-12-34-56-78")).toBe("+33612345678");
    expect(normalizeGuestPhone("06 12 34 56 78")).toBe("+33612345678");
  });

  it.each(["12345", "abc", "+0612", "", "061234567", "+33 6 12 34 56 78 90 12 34"])(
    "%j n'est pas un numéro : null",
    (raw) => {
      expect(normalizeGuestPhone(raw)).toBeNull();
    }
  );
});

describe("guestIdentitySchema", () => {
  const base = { email: "  Amina.Haddad@Example.COM ", firstName: " Amina ", lastName: " Haddad " };

  it("met l'e-mail en minuscules et retire les espaces autour des champs", () => {
    const parsed = guestIdentitySchema.parse({ ...base, phone: "06 12 34 56 78" });
    expect(parsed).toEqual({
      email: "amina.haddad@example.com",
      firstName: "Amina",
      lastName: "Haddad",
      phone: "+33612345678",
    });
  });

  it("un téléphone vide ou absent devient null", () => {
    expect(guestIdentitySchema.parse({ ...base, phone: "" }).phone).toBeNull();
    expect(guestIdentitySchema.parse({ ...base, phone: "   " }).phone).toBeNull();
    expect(guestIdentitySchema.parse(base).phone).toBeNull();
  });

  it("refuse un téléphone invalide avec le message français, sur le champ phone", () => {
    const result = guestIdentitySchema.safeParse({ ...base, phone: "12345" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual([
      expect.objectContaining({ path: ["phone"], message: PHONE_MESSAGE }),
    ]);
  });

  it("refuse un e-mail invalide, un prénom ou un nom vide", () => {
    const result = guestIdentitySchema.safeParse({
      email: "pas-un-email",
      firstName: " ",
      lastName: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join("."), issue.message])
    );
    expect(messages).toEqual({
      email: "Email invalide",
      firstName: "Prénom requis",
      lastName: "Nom requis",
    });
  });

  it("borne les longueurs : 50 caractères pour un prénom ou un nom, 200 pour l'e-mail", () => {
    const fifty = "a".repeat(50);
    const parsed = guestIdentitySchema.parse({ ...base, firstName: fifty, lastName: fifty });
    expect(parsed.firstName).toBe(fifty);
    expect(parsed.lastName).toBe(fifty);
    const long = "a".repeat(51);
    expect(guestIdentitySchema.safeParse({ ...base, firstName: long }).success).toBe(false);
    expect(guestIdentitySchema.safeParse({ ...base, lastName: long }).success).toBe(false);
    const longEmail = `${"a".repeat(196)}@x.fr`; // 201 caractères
    expect(guestIdentitySchema.safeParse({ ...base, email: longEmail }).success).toBe(false);
  });

  it("refuse un prénom ou un nom qui n'est pas fait de lettres, avec le message français du champ", () => {
    const result = guestIdentitySchema.safeParse({
      ...base,
      firstName: "<img src=x onerror=alert(1)>",
      lastName: "12345",
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["firstName"], message: FIRST_NAME_INVALID }),
      expect.objectContaining({ path: ["lastName"], message: LAST_NAME_INVALID }),
    ]);
  });

  it("garde un prénom composé accentué et une apostrophe, en forme NFC et espaces réduits", () => {
    // "Zoe" + U+0301 et "A" + "i" + U+0308 : saisis décomposés, rendus composés.
    const parsed = guestIdentitySchema.parse({
      ...base,
      firstName: "  Zoé-Aïcha ",
      lastName: "O'Brien  Haddad",
    });
    expect(parsed.firstName).toBe("Zoé-Aïcha");
    expect(parsed.lastName).toBe("O'Brien Haddad");
  });
});

describe("clientIp", () => {
  function request(headers: Record<string, string>) {
    return { headers: new Headers(headers) };
  }

  it("lit d'abord x-real-ip", () => {
    expect(
      clientIp(request({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "203.0.113.9" }))
    ).toBe("198.51.100.7");
  });

  it("sinon la première entrée de x-forwarded-for, sans espaces", () => {
    expect(clientIp(request({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("sinon 'unknown'", () => {
    expect(clientIp(request({}))).toBe("unknown");
    expect(clientIp(request({ "x-forwarded-for": " , 10.0.0.1" }))).toBe("unknown");
  });
});
