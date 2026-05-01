// POST /api/webmaster/prospects/import-csv
// Body: { csv: string }  — CSV content with columns:
//   name,address,city,zipCode,phone,googleUrl,rating,reviewCount,googlePlaceId
// Upserts prospects on googlePlaceId to avoid duplicates.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  csv: z.string().min(1).max(2_000_000), // 2MB max
});

// Minimal CSV parser — handles quoted fields with commas
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const { csv } = schema.parse(body);

    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return apiError("VALIDATION_ERROR", "CSV vide ou sans data row");
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const required = ["name", "city"];
    for (const r of required) {
      if (!headers.includes(r)) {
        return apiError("VALIDATION_ERROR", `Colonne manquante: ${r}`);
      }
    }

    const idx = (col: string) => headers.indexOf(col);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const get = (k: string) => {
        const j = idx(k);
        return j >= 0 && cols[j] ? cols[j] : null;
      };

      const name = get("name");
      const city = get("city");
      if (!name || !city) {
        skipped++;
        continue;
      }

      const data = {
        name,
        city,
        zipCode: get("zipcode") || get("zip_code"),
        address: get("address"),
        phone: get("phone"),
        email: get("email"),
        googleUrl: get("googleurl") || get("google_url"),
        rating: get("rating") ? parseFloat(get("rating")!) : null,
        reviewCount: get("reviewcount") || get("review_count")
          ? parseInt((get("reviewcount") || get("review_count"))!, 10)
          : null,
        googlePlaceId: get("googleplaceid") || get("google_place_id"),
        source: "GOOGLE_PLACES" as const,
      };

      try {
        if (data.googlePlaceId) {
          // upsert
          const existing = await prisma.prospect.findUnique({
            where: { googlePlaceId: data.googlePlaceId },
          });
          if (existing) {
            await prisma.prospect.update({
              where: { googlePlaceId: data.googlePlaceId },
              data: {
                name: data.name,
                rating: data.rating,
                reviewCount: data.reviewCount,
                phone: data.phone || existing.phone,
                address: data.address || existing.address,
              },
            });
            updated++;
          } else {
            await prisma.prospect.create({ data });
            inserted++;
          }
        } else {
          // No googlePlaceId — just insert (no dedup)
          await prisma.prospect.create({ data });
          inserted++;
        }
      } catch (e) {
        errors.push(`Line ${i + 1}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    return apiSuccess({
      inserted,
      updated,
      skipped,
      errors: errors.slice(0, 20), // cap to avoid huge response
      totalRows: lines.length - 1,
    });
  } catch (error) {
    return handleApiError(error, "webmaster/prospects/import-csv");
  }
}
