// @vitest-environment node
// refusalMessageOf / refusalMessage : la phrase française d'une action refusée, lue dans
// l'enveloppe d'erreur de l'API (`{ success: false, error: { code, message } }`,
// src/lib/api/errors.ts) ou dans l'ancien `{ error: "texte" }` ; sinon rien (null) ou le message de
// repli de l'écran (page d'erreur HTML, corps vide ou tronqué, objet sans message).
import { describe, expect, it } from "vitest";
import { refusalMessage, refusalMessageOf } from "@/lib/api/client-refusal";

const FALLBACK = "Une erreur est survenue";
const ENVELOPE = {
  success: false,
  error: { code: "CONFLICT", message: "Boutique suspendue : réactivez-la d'abord" },
};

function response(body: string, contentType: string, status = 409): Response {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

describe("refusalMessageOf", () => {
  it("rend le message de l'enveloppe d'erreur", () => {
    expect(refusalMessageOf(ENVELOPE)).toBe("Boutique suspendue : réactivez-la d'abord");
  });

  it("rend le texte de l'ancien corps { error: 'texte' } (/api/chat, scraping)", () => {
    expect(refusalMessageOf({ error: "Trop de requêtes, réessayez dans une minute" })).toBe(
      "Trop de requêtes, réessayez dans une minute"
    );
  });

  it.each([
    ["un objet d'erreur sans message", { error: { code: "CONFLICT" } }],
    ["un message vide", { error: { message: "" } }],
    ["un message blanc", { error: { message: "  \n" } }],
    ["un message non textuel", { error: { message: 42 } }],
    ["un texte d'erreur blanc", { error: "   " }],
    ["un corps sans erreur", { success: true, data: {} }],
    ["un corps qui n'est pas un objet", "Erreur"],
    ["null", null],
  ])("%s : null", (_label, body) => {
    expect(refusalMessageOf(body)).toBeNull();
  });
});

describe("refusalMessage", () => {
  it("rend le message de l'enveloppe d'erreur", async () => {
    const res = response(JSON.stringify(ENVELOPE), "application/json");

    expect(await refusalMessage(res)).toBe("Boutique suspendue : réactivez-la d'abord");
  });

  it("rend le texte de l'ancien corps { error: 'texte' }", async () => {
    const res = response(JSON.stringify({ error: "Non autorisé" }), "application/json", 401);

    expect(await refusalMessage(res)).toBe("Non autorisé");
  });

  it.each([
    ["une page HTML", "<html><body>502 Bad Gateway</body></html>", "text/html"],
    ["un corps vide", "", "application/json"],
    ["un JSON tronqué", '{"success":false,"error":{"mess', "application/json"],
    [
      "un objet d'erreur sans message",
      JSON.stringify({ error: { code: "X" } }),
      "application/json",
    ],
  ])("%s : message générique", async (_label, body, contentType) => {
    expect(await refusalMessage(response(body, contentType, 502))).toBe(FALLBACK);
  });

  it("rend le message de repli de l'écran quand le corps n'en porte aucun", async () => {
    const res = response("<html>502</html>", "text/html", 502);

    expect(await refusalMessage(res, "Erreur serveur")).toBe("Erreur serveur");
  });
});
