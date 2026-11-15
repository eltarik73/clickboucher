// @vitest-environment node
// Transports WhatsApp et push. Non configurés (sans Twilio, sans clés VAPID), ils ne se disent pas
// servis et ne contactent personne. Le push dit ce qu'est devenu l'envoi : sent, expired (abonnement
// disparu, à effacer), failed (à garder), not_configured. Aucun journal ne cite le numéro, le titre,
// le corps ni l'adresse de l'abonnement.
import webpush, { WebPushError } from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PHONE = "+33612345678";
const BODY = "Votre commande KG26-000166 chez Boucherie du Lac est PRÊTE !";

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";
const CONSOLE_METHODS: ConsoleMethod[] = ["log", "info", "warn", "error", "debug"];

let logged: { method: ConsoleMethod; text: string }[] = [];

function serialize(args: unknown[]): string {
  return JSON.stringify(args, (_key, value: unknown) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value
  );
}

function allLogs(): string {
  return logged.map((line) => line.text).join("\n");
}

beforeEach(() => {
  logged = [];
  vi.resetModules();
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push({ method, text: serialize(args) });
    });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WhatsApp sans Twilio", () => {
  beforeEach(() => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    vi.stubEnv("TWILIO_WHATSAPP_FROM", "");
  });

  it("sendWhatsAppRaw rend false, n'appelle pas Twilio et ne journalise ni le numéro ni le corps", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { sendWhatsAppRaw } = await import("@/lib/whatsapp");

    const sent = await sendWhatsAppRaw(PHONE, BODY);

    expect(sent).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    const warnings = logged.filter((line) => line.method === "warn").map((line) => line.text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("***78");
    expect(allLogs()).not.toContain("612345678");
    expect(allLogs()).not.toContain("KG26-000166");
  });

  it("sendWhatsAppMessage (gabarit) rend false et ne journalise pas le message composé", async () => {
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp");

    const sent = await sendWhatsAppMessage(PHONE, "ORDER_READY", {
      orderNumber: "KG26-000166",
      shopName: "Boucherie du Lac",
    });

    expect(sent).toBe(false);
    expect(allLogs()).not.toContain("612345678");
    expect(allLogs()).not.toContain("KG26-000166");
    expect(allLogs()).not.toContain("Boucherie du Lac");
  });
});

const SUBSCRIPTION = {
  endpoint: "https://push.example/send/abc123secret",
  keys: { p256dh: "p", auth: "a" },
};
const PAYLOAD = { title: "Commande prête chez Boucherie du Lac", body: BODY };

function expectNoPersonalData(): void {
  expect(allLogs()).not.toContain("Boucherie du Lac");
  expect(allLogs()).not.toContain("KG26-000166");
  expect(allLogs()).not.toContain("abc123secret");
}

describe("push sans clés VAPID", () => {
  beforeEach(() => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_EMAIL", "");
  });

  it("sendPushNotification rend not_configured, ne contacte personne et ne journalise ni le titre ni le corps", async () => {
    const send = vi.spyOn(webpush, "sendNotification");
    const { sendPushNotification } = await import("@/lib/push");

    expect(await sendPushNotification(SUBSCRIPTION, PAYLOAD)).toBe("not_configured");
    expect(send).not.toHaveBeenCalled();
    const warnings = logged.filter((line) => line.method === "warn").map((line) => line.text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("VAPID");
    expectNoPersonalData();
  });
});

describe("push avec des clés VAPID refusées par web-push", () => {
  it("sendPushNotification rend not_configured, journalise une erreur et n'envoie rien", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "pas-une-cle");
    vi.stubEnv("VAPID_PRIVATE_KEY", "pas-une-cle");
    vi.stubEnv("VAPID_EMAIL", "contact@klikandgo.app");
    const send = vi.spyOn(webpush, "sendNotification");
    const { sendPushNotification } = await import("@/lib/push");

    expect(await sendPushNotification(SUBSCRIPTION, PAYLOAD)).toBe("not_configured");
    expect(send).not.toHaveBeenCalled();
    expect(logged.filter((line) => line.method === "error")).toHaveLength(1);
    expectNoPersonalData();
  });
});

describe("push avec clés VAPID valides", () => {
  beforeEach(() => {
    const keys = webpush.generateVAPIDKeys();
    vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
    vi.stubEnv("VAPID_EMAIL", "contact@klikandgo.app");
  });

  function refusedWith(statusCode: number): WebPushError {
    return new WebPushError(
      "Received unexpected response code",
      statusCode,
      {},
      "",
      SUBSCRIPTION.endpoint
    );
  }

  it("rend sent quand le service de push accepte la notification", async () => {
    const send = vi.spyOn(webpush, "sendNotification").mockResolvedValue({
      statusCode: 201,
      body: "",
      headers: {},
    });
    const { sendPushNotification } = await import("@/lib/push");

    expect(await sendPushNotification(SUBSCRIPTION, PAYLOAD)).toBe("sent");
    expect(send).toHaveBeenCalledWith(SUBSCRIPTION, JSON.stringify(PAYLOAD));
  });

  // RFC 8030 § 7.3 : 404 et 410 disent l'abonnement disparu, à effacer.
  it.each([404, 410])("rend expired sur %i", async (statusCode) => {
    vi.spyOn(webpush, "sendNotification").mockRejectedValue(refusedWith(statusCode));
    const { sendPushNotification } = await import("@/lib/push");

    expect(await sendPushNotification(SUBSCRIPTION, PAYLOAD)).toBe("expired");
    expectNoPersonalData();
  });

  it.each([
    ["une erreur 500", refusedWith(500)],
    ["une limitation 429", refusedWith(429)],
    ["une erreur réseau", new Error("socket hang up")],
  ])("rend failed sur %s, sans rien journaliser de personnel", async (_label, error) => {
    vi.spyOn(webpush, "sendNotification").mockRejectedValue(error);
    const { sendPushNotification } = await import("@/lib/push");

    expect(await sendPushNotification(SUBSCRIPTION, PAYLOAD)).toBe("failed");
    expect(logged.filter((line) => line.method === "error")).toHaveLength(1);
    expectNoPersonalData();
  });
});
