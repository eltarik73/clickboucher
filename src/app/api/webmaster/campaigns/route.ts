// /api/webmaster/campaigns — Campaign management
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { generateEmailContent } from "@/lib/services/campaign.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — List all campaigns with stats
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const stats = {
      total: campaigns.length,
      drafts: campaigns.filter((c) => c.status === "DRAFT").length,
      sent: campaigns.filter((c) => c.status === "SENT").length,
      totalSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
      totalOpens: campaigns.reduce((sum, c) => sum + c.openCount, 0),
    };

    return apiSuccess({ campaigns, stats });
  } catch (error) {
    return handleApiError(error, "webmaster/campaigns/GET");
  }
}

// POST — Create a new campaign (with optional AI generation)
const createSchema = z.object({
  type: z.enum(["NEWSLETTER_CLIENT", "EMAIL_BUTCHER", "SPECIAL_OFFER"]),
  segment: z.enum(["ALL", "LOYAL", "INACTIVE", "BUTCHERS"]),
  objective: z.string().min(5).max(500),
  keywords: z.array(z.string()).default([]),
  tone: z.string().max(100).optional(),
  // Optional manual content (skip AI)
  subject: z.string().min(1).max(200).optional(),
  htmlContent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const body = await req.json();
    const data = createSchema.parse(body);

    let subject = data.subject || "";
    let htmlContent = data.htmlContent || "";

    // Generate with AI if no manual content
    if (!subject || !htmlContent) {
      const generated = await generateEmailContent({
        type: data.type,
        segment: data.segment,
        objective: data.objective,
        keywords: data.keywords,
        tone: data.tone,
      });
      subject = subject || generated.subject;
      htmlContent = htmlContent || generated.htmlContent;
    }

    const campaign = await prisma.campaign.create({
      data: {
        type: data.type,
        segment: data.segment,
        subject,
        htmlContent,
        keywords: data.keywords,
        status: "DRAFT",
        createdById: authResult.userId,
      },
    });

    return apiSuccess(campaign);
  } catch (error) {
    return handleApiError(error, "webmaster/campaigns/POST");
  }
}
