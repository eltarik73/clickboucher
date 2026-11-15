// @vitest-environment node
// Masquage des coordonnées dans les journaux : une ligne de log ne porte jamais une adresse e-mail
// ni un numéro de téléphone complets, seulement de quoi recouper un cas avec la base.
import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "@/lib/log-mask";

describe("maskEmail", () => {
  it.each([
    ["client@example.com", "c***@example.com"],
    ["Client.Nom+tag@sous.example.fr", "C***@sous.example.fr"],
    ["  client@example.com ", "c***@example.com"],
    // La partie locale peut contenir un « @ » entre guillemets : le domaine suit le dernier.
    ['"a@b"@example.com', '"***@example.com'],
  ])("masque %j en %j", (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it.each([
    ["", "chaîne vide"],
    ["client", "sans @"],
    ["@example.com", "sans partie locale"],
    ["client@", "sans domaine"],
    ["   ", "espaces seuls"],
  ])("rend *** pour %j (%s)", (email) => {
    expect(maskEmail(email)).toBe("***");
  });
});

describe("maskPhone", () => {
  it.each([
    ["+33612345678", "***78"],
    ["06 12 34 56 78", "***78"],
    ["whatsapp:+33612345678", "***78"],
    ["06.12.34.56.07", "***07"],
  ])("ne garde que les deux derniers chiffres de %j : %j", (phone, masked) => {
    expect(maskPhone(phone)).toBe(masked);
  });

  it.each([
    ["", "chaîne vide"],
    ["abc", "aucun chiffre"],
    ["12", "trop court : les deux chiffres seraient tout le numéro"],
    ["+3", "un seul chiffre"],
  ])("rend *** pour %j (%s)", (phone) => {
    expect(maskPhone(phone)).toBe("***");
  });
});
