import { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Nom de la boucherie requis").max(200),
  address: z.string().min(5, "Adresse requise").max(500),
  city: z.string().min(2, "Ville requise").max(100),
  phone: z.string().min(10, "Telephone invalide").max(20),
  email: z.string().email("Email invalide"),
  siret: z.string().regex(/^[0-9]{14}$/, "SIRET invalide (14 chiffres)"),
  description: z.string().max(500).optional(),
  pack: z.enum(["essentiel", "premium", "entreprise"]).optional(),
});

// ── POST /api/shops/register ──────────────────────
// Register a new butcher shop
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const data = registerSchema.parse(body);

    // Ensure user exists
    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    // Check user doesn't already own a shop
    const existingShop = await prisma.shop.findFirst({
      where: { ownerId: userId },
    });
    if (existingShop) {
      return apiError("CONFLICT", "Vous avez deja une boucherie enregistree");
    }

    // Generate slug from name
    const baseSlug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Ensure slug uniqueness
    let slug = baseSlug;
    let counter = 0;
    while (await prisma.shop.findUnique({ where: { slug } })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // Create shop
    const shop = await prisma.shop.create({
      data: {
        name: data.name,
        slug,
        address: data.address,
        city: data.city,
        phone: data.phone,
        description: data.description || null,
        ownerId: userId,
        isOpen: false,
        paused: true,
        rating: 0,
        ratingCount: 0,
        prepTimeMin: 15,
        busyMode: false,
        busyExtraMin: 10,
        autoAccept: false,
        maxOrdersHour: 20,
        commissionPct: 0,
        openingHours: JSON.stringify({}),
      },
    });

    // Update user role to BOUCHER
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "BOUCHER" },
    });

    // Update Clerk metadata
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: "boucher" },
    });

    return apiSuccess({ shopId: shop.id, slug: shop.slug }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
