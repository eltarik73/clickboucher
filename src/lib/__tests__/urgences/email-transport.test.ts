// @vitest-environment node
// Transport e-mail honnête : sendEmail ne répond true que lorsque Resend a accepté le message.
// Resend 6 ne lève pas sur un refus, il répond { data: null, error } ; une clé absente n'envoie
// rien. Dans chaque cas d'échec, le journal porte le destinataire masqué et jamais l'adresse
// complète, le sujet ni le corps.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const TO = "client@example.com";
const MASKED_TO = "c***@example.com";
const SUBJECT = "Commande KG26-000166 confirmée — Boucherie du Lac";
const HTML = "<p>Bonjour Fatima, votre commande KG26-000166 est confirmée.</p>";

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";
const CONSOLE_METHODS: ConsoleMethod[] = ["log", "info", "warn", "error", "debug"];

let logged: { method: ConsoleMethod; text: string }[] = [];

// JSON.stringify rend {} pour une Error : on sérialise ses champs pour ne rien laisser passer.
function serialize(args: unknown[]): string {
  return JSON.stringify(args, (_key, value: unknown) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value
  );
}

async function loadSendEmail() {
  // Le client Resend est mémorisé par le module : un module neuf par cas.
  vi.resetModules();
  const { sendEmail } = await import("@/lib/email");
  return sendEmail;
}

function expectNoPersonalDataLogged() {
  const all = logged.map((line) => line.text).join("\n");
  expect(all).not.toContain(TO);
  expect(all).not.toContain(SUBJECT);
  expect(all).not.toContain(HTML);
}

beforeEach(() => {
  logged = [];
  resendSend.mockReset();
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push({ method, text: serialize(args) });
    });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("rend false quand Resend refuse le message ({ data: null, error }) et journalise le refus masqué", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    resendSend.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too many requests", statusCode: 429 },
    });
    const sendEmail = await loadSendEmail();

    const sent = await sendEmail(TO, SUBJECT, HTML);

    expect(sent).toBe(false);
    expect(resendSend).toHaveBeenCalledTimes(1);
    const errors = logged.filter((line) => line.method === "error").map((line) => line.text);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("rate_limit_exceeded");
    expect(errors[0]).toContain("Too many requests");
    expect(errors[0]).toContain(MASKED_TO);
    expectNoPersonalDataLogged();
  });

  it("rend false quand l'appel à Resend lève, et journalise l'erreur avec le destinataire masqué", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    resendSend.mockRejectedValue(new Error("socket hang up"));
    const sendEmail = await loadSendEmail();

    const sent = await sendEmail(TO, SUBJECT, HTML);

    expect(sent).toBe(false);
    const errors = logged.filter((line) => line.method === "error").map((line) => line.text);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("socket hang up");
    expect(errors[0]).toContain(MASKED_TO);
    expectNoPersonalDataLogged();
  });

  it("rend false sans RESEND_API_KEY, sans appeler Resend, et le dit avec le destinataire masqué", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const sendEmail = await loadSendEmail();

    const sent = await sendEmail(TO, SUBJECT, HTML);

    expect(sent).toBe(false);
    expect(resendSend).not.toHaveBeenCalled();
    const warnings = logged.filter((line) => line.method === "warn").map((line) => line.text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("RESEND_API_KEY");
    expect(warnings[0]).toContain(MASKED_TO);
    expectNoPersonalDataLogged();
  });

  // Témoin : un transport qui répondrait toujours false passerait les trois cas ci-dessus.
  it("rend true quand Resend accepte le message, envoyé tel quel à l'adresse complète", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    resendSend.mockResolvedValue({ data: { id: "x" }, error: null });
    const sendEmail = await loadSendEmail();

    const sent = await sendEmail(TO, SUBJECT, HTML);

    expect(sent).toBe(true);
    expect(resendSend).toHaveBeenCalledWith({
      from: "Klik&Go <noreply@klikandgo.app>",
      to: [TO],
      subject: SUBJECT,
      html: HTML,
    });
    expect(logged.filter((line) => line.method === "error" || line.method === "warn")).toEqual([]);
  });
});
