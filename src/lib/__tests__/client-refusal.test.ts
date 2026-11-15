// @vitest-environment node
// refusalMessage : le message français d'une action refusée, lu dans l'enveloppe d'erreur de
// l'API (`{ success: false, error: { code, message } }`, src/lib/api/errors.ts), ou un message
// générique quand la réponse n'est pas cette enveloppe (page d'erreur HTML, corps vide ou tronqué).
import { describe, expect, it } from "vitest";
import { refusalMessage } from "@/lib/api/client-refusal";

const FALLBACK = "Une erreur est survenue";

function response(body: string, contentType: string, status = 409): Response {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

describe("refusalMessage", () => {
  it("rend le message de l'enveloppe d'erreur", async () => {
    const res = response(
      JSON.stringify({
        success: false,
        error: { code: "CONFLICT", message: "Boutique suspendue : réactivez-la d'abord" },
      }),
      "application/json"
    );

    expect(await refusalMessage(res)).toBe("Boutique suspendue : réactivez-la d'abord");
  });

  it.each([
    ["une page HTML", "<html><body>502 Bad Gateway</body></html>", "text/html"],
    ["un corps vide", "", "application/json"],
    ["un JSON tronqué", '{"success":false,"error":{"mess', "application/json"],
    ["un JSON sans enveloppe", JSON.stringify({ error: "Non autorisé" }), "application/json"],
    ["un message vide", JSON.stringify({ error: { message: "" } }), "application/json"],
    ["un message non textuel", JSON.stringify({ error: { message: 42 } }), "application/json"],
  ])("%s : message générique", async (_label, body, contentType) => {
    expect(await refusalMessage(response(body, contentType, 502))).toBe(FALLBACK);
  });
});
