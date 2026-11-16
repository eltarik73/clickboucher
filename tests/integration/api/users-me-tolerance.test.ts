// @vitest-environment node
// The member's weighing tolerance in his profile, on real PostgreSQL: GET /api/users/me returns it
// (null until he chooses), PATCH /api/users/me saves it on the caller's own row only, alone or with
// the notification fields, and refuses an unknown value, an unknown field, an empty object or a body
// that is not JSON, writing nothing. Only the caller's session is simulated; the Upstash limiter is
// inert, as without Redis.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
});
const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: async () => auth.clerkId }));

import { GET, PATCH } from "@/app/api/users/me/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestUser } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

interface Answer {
  status: number;
  body: {
    data?: Record<string, unknown>;
    error?: { code: string; message: string; details?: Record<string, string[]> };
  };
}

async function answer(response: Response): Promise<Answer> {
  return { status: response.status, body: (await response.json()) as Answer["body"] };
}

const patch = async (body: string) =>
  answer(
    await PATCH(
      new NextRequest("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
      })
    )
  );

const rowOf = (user: User) => prisma.user.findUniqueOrThrow({ where: { id: user.id } });

let member: User;
let other: User;

beforeEach(async () => {
  member = await createTestUser();
  other = await createTestUser({ weighTolerance: "STANDARD" });
  auth.clerkId = member.clerkId;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/users/me", () => {
  it("returns null before any choice, then the saved choice", async () => {
    expect((await answer(await GET())).body.data).toMatchObject({ weighTolerance: null });

    await prisma.user.update({ where: { id: member.id }, data: { weighTolerance: "EXTENDED" } });

    expect((await answer(await GET())).body.data).toMatchObject({ weighTolerance: "EXTENDED" });
  });
});

describe("PATCH /api/users/me — weighing tolerance", () => {
  it("saves the caller's choice alone; another member's row is unchanged", async () => {
    const otherBefore = await rowOf(other);

    const saved = await patch(JSON.stringify({ weighTolerance: "EXTENDED" }));

    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ id: member.id, weighTolerance: "EXTENDED" });
    expect((await rowOf(member)).weighTolerance).toBe("EXTENDED");
    expect(await rowOf(other)).toEqual(otherBefore);
    expect((await answer(await GET())).body.data).toMatchObject({ weighTolerance: "EXTENDED" });
  });

  it("saves it with the notification fields of the same request", async () => {
    const saved = await patch(JSON.stringify({ notifSms: false, weighTolerance: "STANDARD" }));

    expect(saved.status).toBe(200);
    expect(await rowOf(member)).toMatchObject({ notifSms: false, weighTolerance: "STANDARD" });
  });

  it("keeps the phone rule: SMS without a phone is refused and nothing is saved", async () => {
    const refused = await patch(JSON.stringify({ notifSms: true, weighTolerance: "STANDARD" }));

    expect(refused.status).toBe(400);
    expect(refused.body.error?.message).toBe(
      "Numéro de téléphone requis pour les notifications SMS/WhatsApp"
    );
    expect((await rowOf(member)).weighTolerance).toBeNull();
  });

  it.each([
    ["an unknown choice", { weighTolerance: "GENEREUX" }, "weighTolerance"],
    ["an amount", { weighTolerance: "STANDARD", weighToleranceCapCents: 99_999 }, "_root"],
    ["another member's field", { weighTolerance: "STANDARD", role: "ADMIN" }, "_root"],
    ["an empty object", {}, "_root"],
  ])("refuses %s: 400 VALIDATION_ERROR, nothing written", async (_label, body, detailKey) => {
    const before = await rowOf(member);

    const refused = await patch(JSON.stringify(body));

    expect(refused.status).toBe(400);
    expect(refused.body.error?.code).toBe("VALIDATION_ERROR");
    expect(refused.body.error?.details).toHaveProperty([detailKey]);
    expect(await rowOf(member)).toEqual(before);
  });

  it("names an unknown choice in French", async () => {
    const refused = await patch(JSON.stringify({ weighTolerance: "GENEREUX" }));

    expect(refused.body.error?.details).toEqual({ weighTolerance: ["Marge de pesée inconnue"] });
  });

  it("answers 400 VALIDATION_ERROR to a body that is not JSON, without a server error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const before = await rowOf(member);

    for (const body of ["{pas du json", ""]) {
      const refused = await patch(body);
      expect(refused.status).toBe(400);
      expect(refused.body.error?.code).toBe("VALIDATION_ERROR");
    }

    expect(consoleError).not.toHaveBeenCalled();
    expect(await rowOf(member)).toEqual(before);
  });

  it("answers 401 without a session and writes nothing", async () => {
    auth.clerkId = null;
    const before = await rowOf(member);

    expect((await patch(JSON.stringify({ weighTolerance: "EXTENDED" }))).status).toBe(401);
    expect((await answer(await GET())).status).toBe(401);
    expect(await rowOf(member)).toEqual(before);
  });
});
