// /api/admin/banners — CRUD for site banners
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import prisma from "@/lib/prisma";

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
    const { title, subtitle, imageUrl, linkUrl, position, startsAt, endsAt } = body;

    if (!title || !imageUrl) {
      return apiError("VALIDATION_ERROR", "Titre et image requis");
    }

    const banner = await prisma.siteBanner.create({
      data: {
        title,
        subtitle: subtitle || null,
        imageUrl,
        linkUrl: linkUrl || null,
        position: position ?? 0,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
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
    const { id, ...updates } = body;

    if (!id) return apiError("VALIDATION_ERROR", "ID requis");

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

    const { id } = await req.json();
    if (!id) return apiError("VALIDATION_ERROR", "ID requis");

    await prisma.siteBanner.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err, "admin/banners DELETE");
  }
}
