// /api/admin/banners — CRUD for site banners
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createBannerSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional(),
  position: z.number().int().min(0).max(100).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const updateBannerSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).nullable().optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().nullable().optional(),
  position: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const deleteBannerSchema = z.object({
  id: z.string().min(1),
});

// GET — List all banners
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const banners = await prisma.siteBanner.findMany({
      orderBy: { position: "asc" },
    });
    return apiSuccess(banners);
  } catch (err) {
    return handleApiError(err, "admin/banners GET");
  }
}

// POST — Create banner
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = createBannerSchema.parse(body);

    const banner = await prisma.siteBanner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl || null,
        position: data.position ?? 0,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdBy: admin.userId,
      },
    });

    return apiSuccess(banner, 201);
  } catch (err) {
    return handleApiError(err, "admin/banners POST");
  }
}

// PATCH — Update banner
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const { id, ...updates } = updateBannerSchema.parse(body);

    const banner = await prisma.siteBanner.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.subtitle !== undefined && { subtitle: updates.subtitle }),
        ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
        ...(updates.linkUrl !== undefined && { linkUrl: updates.linkUrl }),
        ...(updates.position !== undefined && { position: updates.position }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.startsAt !== undefined && { startsAt: updates.startsAt ? new Date(updates.startsAt) : null }),
        ...(updates.endsAt !== undefined && { endsAt: updates.endsAt ? new Date(updates.endsAt) : null }),
      },
    });

    return apiSuccess(banner);
  } catch (err) {
    return handleApiError(err, "admin/banners PATCH");
  }
}

// DELETE — Remove banner
export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = deleteBannerSchema.parse(await req.json());

    await prisma.siteBanner.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err, "admin/banners DELETE");
  }
}
