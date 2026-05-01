// src/app/api/webmaster/prospects/[id]/send-email/route.ts
// Send a prospect outreach email (initial / 3j / 7j relance) — admin only
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError, formatZodError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { prospectInitial, prospectRelance3j, prospectRelance7j } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  template: z.enum(["initial", "relance_3j", "relance_7j"]),
});

type TemplateKey = z.infer<typeof BodySchema>["template"];

const SUBJECTS: Record<TemplateKey, (city: string) => string> = {
  initial: () => "Klik&Go — La plateforme click & collect gratuite pour les boucheries halal",
  relance_3j: () => "Re: Klik&Go — Une rapide question pour votre boucherie",
  relance_7j: (city: string) => `Dernière relance — Klik&Go pour ${city || "votre boucherie"}`,
};

function renderTemplate(template: TemplateKey, data: { name?: string; city?: string }): string {
  switch (template) {
    case "initial":
      return prospectInitial(data);
    case "relance_3j":
      return prospectRelance3j(data);
    case "relance_7j":
      return prospectRelance7j(data);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Paramètres invalides", formatZodError(parsed.error));
    }

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        city: true,
        email: true,
        status: true,
        emailsSentCount: true,
      },
    });

    if (!prospect) {
      return apiError("NOT_FOUND", "Prospect introuvable");
    }

    if (!prospect.email) {
      return apiError("VALIDATION_ERROR", "Ce prospect n'a pas d'email");
    }

    const { template } = parsed.data;
    const html = renderTemplate(template, { name: prospect.name, city: prospect.city });
    const subject = SUBJECTS[template](prospect.city);

    const sent = await sendEmail(prospect.email, subject, html);
    if (!sent) {
      return apiError("INTERNAL_ERROR", "Envoi de l'email échoué");
    }

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        emailsSentCount: { increment: 1 },
        lastEmailAt: new Date(),
        ...(prospect.status === "NEW"
          ? { status: "CONTACTED", contactedAt: new Date() }
          : {}),
      },
    });

    return apiSuccess({ sent: true });
  } catch (error) {
    return handleApiError(error, "webmaster/prospects/send-email");
  }
}
