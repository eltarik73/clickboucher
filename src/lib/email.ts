import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { maskEmail } from "@/lib/log-mask";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * true seulement quand Resend a accepté le message. Resend ne lève pas sur un refus : il répond
 * { data: null, error }. Les journaux ne portent que le destinataire masqué, jamais le sujet ni
 * le corps.
 */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  const client = getResend();

  if (!client) {
    logger.warn("[email] RESEND_API_KEY absente : e-mail non envoyé", { to: maskEmail(to) });
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: "Klik&Go <noreply@klikandgo.app>",
      to: [to],
      subject,
      html: htmlBody,
    });
    if (error) {
      logger.error("[email] Envoi refusé par Resend", {
        name: error.name,
        message: error.message,
        to: maskEmail(to),
      });
      return false;
    }
    return true;
  } catch (error) {
    // Champs recopiés : une Error rangée telle quelle dans le contexte sortirait « {} » en JSON.
    logger.error("[email] Appel à Resend en échec", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
      to: maskEmail(to),
    });
    return false;
  }
}
