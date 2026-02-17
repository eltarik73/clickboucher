// src/app/api/users/me/location/route.ts — Save client location
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().max(200).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const data = locationSchema.parse(body);

    const updated = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city ?? undefined,
      },
      select: { id: true, latitude: true, longitude: true, city: true },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "users/me/location");
  }
}
