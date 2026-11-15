// @vitest-environment node
// Transports non configurés (WhatsApp sans Twilio, push sans clés VAPID) : ils ne se disent pas
// servis, ne contactent personne et ne journalisent ni le numéro, ni le titre, ni le corps.
import webpush from "web-push";
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

describe("push sans clés VAPID", () => {
  beforeEach(() => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_EMAIL", "");
  });

  it("isPushConfigured rend false", async () => {
    const { isPushConfigured } = await import("@/lib/push");

    expect(isPushConfigured()).toBe(false);
  });

  it("sendPushNotification ne journalise ni le titre ni le corps et ne dit pas l'abonnement expiré", async () => {
    const { sendPushNotification } = await import("@/lib/push");

    const result = await sendPushNotification(
      { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } },
      { title: "Commande prête chez Boucherie du Lac", body: BODY }
    );

    // false signifie « abonnement expiré, à supprimer » pour l'appelant : jamais pour une
    // configuration absente (notifications.ts consulte isPushConfigured avant d'envoyer).
    expect(result).toBe(true);
    const warnings = logged.filter((line) => line.method === "warn").map((line) => line.text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("VAPID");
    expect(allLogs()).not.toContain("Boucherie du Lac");
    expect(allLogs()).not.toContain("KG26-000166");
  });
});

describe("push avec clés VAPID valides", () => {
  it("isPushConfigured rend true", async () => {
    const keys = webpush.generateVAPIDKeys();
    vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
    vi.stubEnv("VAPID_EMAIL", "contact@klikandgo.app");
    const { isPushConfigured } = await import("@/lib/push");

    expect(isPushConfigured()).toBe(true);
  });
});
