import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
) {
  const client = getResend();

  if (!client) {
    console.log(`\ud83d\udce7 EMAIL (stub) \u2192 ${to}: ${subject}`);
    return true;
  }

  try {
    await client.emails.send({
      from: "Klik&Go <noreply@klikandgo.fr>",
      to: [to],
      subject,
      html: htmlBody,
    });
    return true;
  } catch (error) {
    console.error("[email] Send failed:", error);
    return false;
  }
}
