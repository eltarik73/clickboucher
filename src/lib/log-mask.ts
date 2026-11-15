// src/lib/log-mask.ts — Seule autorité de masquage des coordonnées dans les journaux.
// Une ligne de log ne porte jamais une adresse e-mail ni un numéro de téléphone complets : de quoi
// recouper un cas avec la base, rien de plus. Pur, sans dépendance, utilisable partout.

const HIDDEN = "***";

/** En dessous, ce n'est pas un numéro : en montrer deux chiffres le montrerait presque entier. */
const MIN_PHONE_DIGITS = 4;

/** 'client@example.com' -> 'c***@example.com' ; sans partie locale ou sans domaine -> '***'. */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return HIDDEN;
  return `${trimmed[0]}${HIDDEN}${trimmed.slice(at)}`;
}

/** '+33612345678' -> '***78' : les deux derniers chiffres seulement. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return HIDDEN;
  return `${HIDDEN}${digits.slice(-2)}`;
}
