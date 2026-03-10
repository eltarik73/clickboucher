// GET /api/support/faq — Search FAQ entries
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase().trim() || "";
    const category = searchParams.get("category") || "";

    const where: Record<string, unknown> = { active: true };
    if (category) where.category = category;

    const faqs = await prisma.fAQ.findMany({
      where,
      orderBy: { order: "asc" },
    });

    // If search query, rank by relevance
    if (q) {
      const scored = faqs.map((faq) => {
        let score = 0;
        const lower = `${faq.question} ${faq.answer}`.toLowerCase();
        if (lower.includes(q)) score += 10;
        for (const kw of faq.keywords) {
          if (q.includes(kw.toLowerCase())) score += 5;
          if (kw.toLowerCase().includes(q)) score += 3;
        }
        // Partial word match
        const words = q.split(/\s+/);
        for (const w of words) {
          if (w.length > 2 && lower.includes(w)) score += 2;
        }
        return { ...faq, score };
      });

      const results = scored
        .filter((f) => f.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return apiSuccess(results);
    }

    return apiSuccess(faqs);
  } catch (error) {
    return handleApiError(error, "support/faq");
  }
}
