// src/lib/commercial-emails.ts — interrupteur « Envoi des e-mails commerciaux » (serveur seulement).
//
// Seule autorité sur la question « peut-on envoyer un e-mail commercial maintenant ? » : campagnes,
// relances de panier abandonné, e-mails aux prospects. Les notifications de commande ne la posent
// jamais. Décision du propriétaire du 2026-11-15 : en pause par défaut, l'admin l'active depuis
// /webmaster/parametres.
import prisma from "@/lib/prisma";

export const COMMERCIAL_EMAILS_CONFIG_KEY = "commercial_emails_enabled";

export const COMMERCIAL_EMAILS_PAUSED_MESSAGE =
  "L'envoi des e-mails commerciaux est en pause. Activez-le dans Paramètres pour envoyer.";

/** Seule valeur stockée qui vaut « activé ». */
const ENABLED_VALUE = "true";
const PAUSED_VALUE = "false";

/**
 * true only when the platform_configs row holds exactly 'true'. A missing row or any other value
 * means paused (fail closed). Read from the database at every call, without the in-memory cache of
 * feature-flags.ts: another serverless instance must stop sending as soon as the admin pauses.
 */
export async function commercialEmailsEnabled(): Promise<boolean> {
  const row = await prisma.platformConfig.findUnique({
    where: { key: COMMERCIAL_EMAILS_CONFIG_KEY },
    select: { value: true },
  });
  return row?.value === ENABLED_VALUE;
}

/** Stores the switch and returns the state it had before (for the audit log) and the new one. */
export async function setCommercialEmailsEnabled(
  enabled: boolean
): Promise<{ previous: boolean; enabled: boolean }> {
  const previous = await commercialEmailsEnabled();
  const value = enabled ? ENABLED_VALUE : PAUSED_VALUE;
  await prisma.platformConfig.upsert({
    where: { key: COMMERCIAL_EMAILS_CONFIG_KEY },
    update: { value },
    create: { key: COMMERCIAL_EMAILS_CONFIG_KEY, value },
  });
  return { previous, enabled };
}
