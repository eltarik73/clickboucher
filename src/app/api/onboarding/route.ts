// POST /api/onboarding — First-time user role selection
import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const onboardingSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("CLIENT") }),
  z.object({
    role: z.literal("BOUCHER"),
    shopName: z.string().min(2, "Nom de boutique trop court"),
    address: z.string().min(5, "Adresse trop courte"),
    city: z.string().min(2, "Ville trop courte"),
    phone: z.string().min(5, "Téléphone trop court"),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const rl = await checkRateLimit(rateLimits.api, `onboarding:${userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    // Check if user already exists in DB
    const existing = await prisma.user.findUnique({
      where: { clerkId: userId },
    });
    if (existing) {
      return apiError("CONFLICT", "Vous avez déjà un compte");
    }

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Données invalides");
    }

    const data = parsed.data;

    // Fetch Clerk user info
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress || "";
    const firstName = clerkUser.firstName || "";
    const lastName = clerkUser.lastName || "";
    const phoneFromClerk = clerkUser.phoneNumbers[0]?.phoneNumber || null;

    if (data.role === "CLIENT") {
      // Create client user
      const user = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          firstName,
          lastName,
          phone: phoneFromClerk,
          role: "CLIENT",
        },
      });

      // Set role in Clerk metadata
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { role: "client" },
      });

      return apiSuccess({ user: { id: user.id, role: user.role } });
    }

    // BOUCHER — create user + shop in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkId: userId,
          email,
          firstName,
          lastName,
          phone: data.phone || phoneFromClerk,
          role: "BOUCHER",
        },
      });

      // Generate unique slug
      let baseSlug = slugify(data.shopName);
      if (!baseSlug) baseSlug = "boutique";
      let slug = baseSlug;
      let attempt = 0;
      while (await tx.shop.findUnique({ where: { slug } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const shop = await tx.shop.create({
        data: {
          name: data.shopName,
          slug,
          address: data.address,
          city: data.city,
          phone: data.phone,
          ownerId: user.id,
          prepTimeMin: 15,
          status: "OPEN",
          visible: false,
          onboardingCompleted: false,
        },
      });

      return { user, shop };
    });

    // Set role in Clerk metadata
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: "boucher" },
    });

    return apiSuccess({
      user: { id: result.user.id, role: result.user.role },
      shop: { id: result.shop.id, slug: result.shop.slug },
    });
  } catch (error) {
    return handleApiError(error, "onboarding");
  }
}
