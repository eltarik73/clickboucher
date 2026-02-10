import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { handleApiError } from "@/lib/api/errors";

// Map Clerk metadata role string to Prisma Role enum
const ROLE_MAP: Record<string, Role> = {
  client: Role.CLIENT,
  client_pro: Role.CLIENT_PRO,
  client_pro_pending: Role.CLIENT_PRO_PENDING,
  boucher: Role.BOUCHER,
  admin: Role.ADMIN,
};

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "CLERK_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  // Read headers for Svix verification
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing Svix headers" },
      { status: 400 }
    );
  }

  // Verify webhook signature
  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  const eventType = event.type;

  try {
    // ── user.created ──────────────────────────
    if (eventType === "user.created") {
      const { id, email_addresses, first_name, last_name, phone_numbers, public_metadata } = event.data;

      const email = email_addresses?.[0]?.email_address;
      if (!email) {
        return NextResponse.json(
          { error: "No email address found" },
          { status: 400 }
        );
      }

      const metadataRole = (public_metadata as Record<string, unknown>)?.role as string | undefined;
      const role = metadataRole ? ROLE_MAP[metadataRole] ?? Role.CLIENT : Role.CLIENT;
      const phone = phone_numbers?.[0]?.phone_number ?? null;

      await prisma.user.create({
        data: {
          clerkId: id,
          email,
          firstName: first_name ?? "",
          lastName: last_name ?? "",
          phone,
          role,
        },
      });

      return NextResponse.json({ success: true, event: "user.created" });
    }

    // ── user.updated ──────────────────────────
    if (eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, phone_numbers, public_metadata } = event.data;

      const email = email_addresses?.[0]?.email_address;
      const phone = phone_numbers?.[0]?.phone_number ?? null;
      const metadataRole = (public_metadata as Record<string, unknown>)?.role as string | undefined;

      const updateData: Record<string, unknown> = {
        firstName: first_name ?? "",
        lastName: last_name ?? "",
        phone,
      };

      if (email) {
        updateData.email = email;
      }

      if (metadataRole && ROLE_MAP[metadataRole]) {
        updateData.role = ROLE_MAP[metadataRole];
      }

      await prisma.user.update({
        where: { clerkId: id },
        data: updateData,
      });

      return NextResponse.json({ success: true, event: "user.updated" });
    }

    // ── user.deleted ──────────────────────────
    if (eventType === "user.deleted") {
      const { id } = event.data;

      if (!id) {
        return NextResponse.json(
          { error: "No user ID in delete event" },
          { status: 400 }
        );
      }

      // Soft delete: disconnect from shops and mark with a deactivated email
      // We keep the user record so orders are preserved
      await prisma.user.update({
        where: { clerkId: id },
        data: {
          email: `deleted_${id}@deactivated.klikgo`,
          firstName: "Compte",
          lastName: "Supprimé",
          phone: null,
        },
      });

      return NextResponse.json({ success: true, event: "user.deleted" });
    }

    // Unknown event type — acknowledge but ignore
    return NextResponse.json({ success: true, event: eventType, ignored: true });
  } catch (error) {
    return handleApiError(error, `webhook/clerk/${eventType}`);
  }
}
