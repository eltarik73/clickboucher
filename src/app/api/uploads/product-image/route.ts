import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import crypto from "crypto";
import { getServerUserId } from "@/lib/auth/server-auth";
import { z } from "zod";

const deleteImageSchema = z.object({
  url: z.string().min(1).max(500),
});

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES_PER_PRODUCT = 5;

// ── POST /api/uploads/product-image ────────────
// Boucher only — upload a product image to Vercel Blob
export async function POST(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // @security: Require BOUCHER/ADMIN role upfront — prevents any authenticated
    // user from uploading to the shared Vercel Blob bucket.
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!dbUser || (dbUser.role !== "BOUCHER" && dbUser.role !== "ADMIN")) {
      return apiError("FORBIDDEN", "Réservé aux bouchers et administrateurs");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productIdRaw = formData.get("productId");

    // @security: productId is now REQUIRED to tie every upload to an owned product.
    const productIdSchema = z.string().min(1, "productId requis");
    const parsed = productIdSchema.safeParse(productIdRaw);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Champ 'productId' requis");
    }
    const productId = parsed.data;

    if (!file) {
      return apiError("VALIDATION_ERROR", "Champ 'file' requis");
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError("VALIDATION_ERROR", "Format accepté : JPEG, PNG ou WebP uniquement");
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError("VALIDATION_ERROR", "Taille maximum : 2 Mo");
    }

    // Verify ownership and image count
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        shop: { select: { ownerId: true } },
        _count: { select: { images: true } },
      },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    const isAdmin = dbUser.role === "ADMIN";
    // Shop.ownerId may store either the Clerk id or the Prisma user id
    const owns =
      product.shop.ownerId === userId || product.shop.ownerId === dbUser.id;
    if (!isAdmin && !owns) {
      return apiError("FORBIDDEN", "Ce produit ne vous appartient pas");
    }
    if (product._count.images >= MAX_IMAGES_PER_PRODUCT) {
      return apiError(
        "VALIDATION_ERROR",
        `Maximum ${MAX_IMAGES_PER_PRODUCT} images par produit`
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify magic bytes (MIME check server-side)
    const isValidMagic = verifyMagicBytes(buffer, file.type);
    if (!isValidMagic) {
      return apiError("VALIDATION_ERROR", "Le fichier ne correspond pas au type MIME déclaré");
    }

    // Resize with sharp (max 800x800, convert to WebP)
    let processedBuffer: Buffer;
    try {
      const sharp = (await import("sharp")).default;
      processedBuffer = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      processedBuffer = buffer;
    }

    // Generate unique filename
    const rand = crypto.randomBytes(8).toString("hex");
    const filename = `products/product-${Date.now()}-${rand}.webp`;

    // Upload to Vercel Blob
    const blob = await put(filename, processedBuffer, {
      access: "public",
      contentType: "image/webp",
    });

    return apiSuccess({ url: blob.url, filename, size: processedBuffer.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/uploads/product-image ───────────
// Boucher only — delete a product image from Vercel Blob
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!dbUser || (dbUser.role !== "BOUCHER" && dbUser.role !== "ADMIN")) {
      return apiError("FORBIDDEN", "Réservé aux bouchers et administrateurs");
    }

    const body = await req.json();
    const { url } = deleteImageSchema.parse(body);

    // Only allow deletion of blob URLs or legacy filesystem URLs
    const isBlobUrl = url.includes(".public.blob.vercel-storage.com");
    const isLegacyUrl = url.startsWith("/api/uploads/products/");

    if (!isBlobUrl && !isLegacyUrl) {
      return apiError("VALIDATION_ERROR", "URL invalide");
    }

    // @security: Resolve the URL to its owning Product + Shop, then verify
    // the current user owns the shop. Admins bypass ownership.
    if (dbUser.role !== "ADMIN") {
      // Try ProductImage join first, fallback to Product.imageUrl
      const productImage = await prisma.productImage.findFirst({
        where: { url },
        select: { product: { select: { shop: { select: { ownerId: true } } } } },
      });
      let ownerId = productImage?.product?.shop?.ownerId;
      if (!ownerId) {
        const product = await prisma.product.findFirst({
          where: { imageUrl: url },
          select: { shop: { select: { ownerId: true } } },
        });
        ownerId = product?.shop?.ownerId;
      }
      if (!ownerId) {
        return apiError("NOT_FOUND", "Image introuvable ou déjà supprimée");
      }
      if (ownerId !== userId && ownerId !== dbUser.id) {
        return apiError("FORBIDDEN", "Cette image ne vous appartient pas");
      }
    }

    if (isBlobUrl) {
      try {
        await del(url);
      } catch {
        // Blob may already be deleted
      }
    }
    // Legacy filesystem URLs: just ignore (files are already gone on Vercel)

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// ── Magic bytes verification ───────────────────
function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  switch (mimeType) {
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case "image/webp":
      return (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
      );
    default:
      return false;
  }
}
