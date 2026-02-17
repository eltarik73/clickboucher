import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "products");
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES_PER_PRODUCT = 5;

async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// ── POST /api/uploads/product-image ────────────
// Boucher only — upload a product image
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;

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

    // If productId provided, verify ownership and image count
    if (productId) {
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
      if (product.shop.ownerId !== userId) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
      if (product._count.images >= MAX_IMAGES_PER_PRODUCT) {
        return apiError("VALIDATION_ERROR", `Maximum ${MAX_IMAGES_PER_PRODUCT} images par produit`);
      }
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify magic bytes (MIME check server-side)
    const isValidMagic = verifyMagicBytes(buffer, file.type);
    if (!isValidMagic) {
      return apiError("VALIDATION_ERROR", "Le fichier ne correspond pas au type MIME déclaré");
    }

    // Resize with sharp (max 800x800)
    let processedBuffer: Buffer;
    try {
      const sharp = (await import("sharp")).default;
      processedBuffer = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      // If sharp fails, store original
      processedBuffer = buffer;
    }

    // Generate unique filename
    const ext = "webp";
    const rand = crypto.randomBytes(8).toString("hex");
    const filename = `product-${Date.now()}-${rand}.${ext}`;

    // Write to disk
    await ensureDir(UPLOADS_DIR);
    const filePath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filePath, processedBuffer);

    const url = `/api/uploads/products/${filename}`;

    return apiSuccess({ url, filename, size: processedBuffer.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/uploads/product-image ───────────
// Boucher only — delete a product image file
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const url = body?.url as string;

    if (!url || typeof url !== "string") {
      return apiError("VALIDATION_ERROR", "Champ 'url' requis");
    }

    // Security: only allow deletion from /api/uploads/products/
    const match = url.match(/^\/api\/uploads\/products\/([a-zA-Z0-9._-]+)$/);
    if (!match) {
      return apiError("VALIDATION_ERROR", "URL invalide — seuls les fichiers dans /uploads/products/ sont autorisés");
    }

    const filename = match[1];
    const filePath = path.join(UPLOADS_DIR, filename);

    // Prevent path traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(UPLOADS_DIR))) {
      return apiError("FORBIDDEN", "Chemin invalide");
    }

    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be deleted, that's OK
    }

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
