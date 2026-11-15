// @vitest-environment node
//
// Stripe key guard (src/lib/stripe.ts): a live key is accepted only on the production deployment
// (one rule for "production": isProductionDeployment, src/lib/auth/test-mode-env.ts), a test key
// only elsewhere, anything else is refused, and isStripeConfigured() says exactly that. Secrets are
// read at call time, and a refused key never appears in an error message.
//
// Dummy keys are assembled from pieces so that no secret scanner mistakes them for real ones. No
// test reaches the network: building a Stripe client sends nothing, and every gateway call below is
// refused before the SDK is reached.
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STRIPE_CLIENT_CONFIG,
  getStripeClient,
  isStripeConfigured,
  stripeKeyRefusal,
  stripeWebhookSecrets,
  type StripeKeyRefusal,
} from "@/lib/stripe";
import { getPaymentGateway } from "@/lib/payments/gateway";

const BODY = "x".repeat(24);
const dummy = (prefix: string, mode: string) => `${prefix}_${mode}_${BODY}`;

const KEYS: Record<string, string | undefined> = {
  missing: undefined,
  empty: "",
  "sk_live_": dummy("sk", "live"),
  "rk_live_": dummy("rk", "live"),
  "sk_test_": dummy("sk", "test"),
  "rk_test_": dummy("rk", "test"),
  "pk_live_": dummy("pk", "live"),
  garbage: "not-a-stripe-key",
};

/** Expected refusal of each key, on the production deployment and anywhere else. */
const EXPECTED: Record<string, { production: StripeKeyRefusal | null; elsewhere: StripeKeyRefusal | null }> = {
  missing: { production: "MISSING", elsewhere: "MISSING" },
  empty: { production: "MISSING", elsewhere: "MISSING" },
  "sk_live_": { production: null, elsewhere: "LIVE_KEY_OUTSIDE_PRODUCTION" },
  "rk_live_": { production: null, elsewhere: "LIVE_KEY_OUTSIDE_PRODUCTION" },
  "sk_test_": { production: "TEST_KEY_IN_PRODUCTION", elsewhere: null },
  "rk_test_": { production: "TEST_KEY_IN_PRODUCTION", elsewhere: null },
  "pk_live_": { production: "UNKNOWN_FORMAT", elsewhere: "UNKNOWN_FORMAT" },
  garbage: { production: "UNKNOWN_FORMAT", elsewhere: "UNKNOWN_FORMAT" },
};

const ENVIRONMENTS: ReadonlyArray<{
  name: string;
  vercelEnv: string | undefined;
  deployEnv: string | undefined;
  production: boolean;
}> = [
  { name: "VERCEL_ENV=production", vercelEnv: "production", deployEnv: undefined, production: true },
  { name: "KLIKGO_DEPLOY_ENV=production", vercelEnv: undefined, deployEnv: "production", production: true },
  { name: "preview", vercelEnv: "preview", deployEnv: "preview", production: false },
  { name: "no deployment variable", vercelEnv: undefined, deployEnv: undefined, production: false },
];

function setDeployment(vercelEnv: string | undefined, deployEnv: string | undefined): void {
  vi.stubEnv("VERCEL_ENV", vercelEnv);
  vi.stubEnv("KLIKGO_DEPLOY_ENV", deployEnv);
}

function setSecretKey(key: string | undefined): void {
  vi.stubEnv("STRIPE_SECRET_KEY", key);
}

/** The message of the error `run` throws (fails the test if it does not throw). */
function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected a throw");
}

beforeEach(() => {
  setDeployment(undefined, undefined);
  setSecretKey(undefined);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", undefined);
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(ENVIRONMENTS)("key guard, $name", ({ vercelEnv, deployEnv, production }) => {
  beforeEach(() => setDeployment(vercelEnv, deployEnv));

  it.each(Object.keys(KEYS))("key %s", (name) => {
    const expected = production ? EXPECTED[name].production : EXPECTED[name].elsewhere;
    setSecretKey(KEYS[name]);

    expect(stripeKeyRefusal(KEYS[name], production)).toBe(expected);
    expect(isStripeConfigured()).toBe(expected === null);
  });
});

describe("stripeKeyRefusal", () => {
  it("is pure: it decides from its arguments, not from the environment", () => {
    setDeployment("production", "production");
    setSecretKey(dummy("sk", "live"));

    expect(stripeKeyRefusal(dummy("sk", "test"), false)).toBeNull();
    expect(stripeKeyRefusal(dummy("sk", "live"), false)).toBe("LIVE_KEY_OUTSIDE_PRODUCTION");
  });

  it("refuses a bare prefix and a key carrying whitespace", () => {
    expect(stripeKeyRefusal("sk_" + "test_", false)).toBe("UNKNOWN_FORMAT");
    expect(stripeKeyRefusal(`${dummy("sk", "test")}\n`, false)).toBe("UNKNOWN_FORMAT");
    expect(stripeKeyRefusal(` ${dummy("sk", "test")}`, false)).toBe("UNKNOWN_FORMAT");
  });
});

describe("getStripeClient", () => {
  it.each([
    { refusal: "MISSING", key: undefined, vercelEnv: undefined },
    { refusal: "LIVE_KEY_OUTSIDE_PRODUCTION", key: dummy("sk", "live"), vercelEnv: "preview" },
    { refusal: "TEST_KEY_IN_PRODUCTION", key: dummy("sk", "test"), vercelEnv: "production" },
    { refusal: "UNKNOWN_FORMAT", key: dummy("pk", "live"), vercelEnv: undefined },
  ])("throws $refusal without printing the key", ({ refusal, key, vercelEnv }) => {
    setDeployment(vercelEnv, undefined);
    setSecretKey(key);

    const message = thrownMessage(() => getStripeClient());

    expect(message).toBe(`Stripe unavailable: ${refusal}`);
    expect(message).not.toContain(BODY);
  });

  it("pins the API version the installed SDK was generated for, a 10 s timeout and 1 retry", () => {
    expect(STRIPE_CLIENT_CONFIG.apiVersion).toBe(Stripe.API_VERSION);
    expect(STRIPE_CLIENT_CONFIG.timeout).toBe(10_000);
    expect(STRIPE_CLIENT_CONFIG.maxNetworkRetries).toBe(1);
    expect(STRIPE_CLIENT_CONFIG.typescript).toBe(true);
  });

  it("builds the client from that configuration", () => {
    setSecretKey(dummy("sk", "test"));

    const client = getStripeClient();

    expect(client).toBeInstanceOf(Stripe);
    expect(client.getMaxNetworkRetries()).toBe(1);
    expect(client.getApiField("timeout")).toBe(10_000);
    expect(client.getApiField("version")).toBe(STRIPE_CLIENT_CONFIG.apiVersion);
  });

  it("reuses the client while the key is the same string, and only then", () => {
    setSecretKey(dummy("sk", "test"));
    const first = getStripeClient();
    expect(getStripeClient()).toBe(first);

    setSecretKey(dummy("rk", "test"));
    const second = getStripeClient();
    expect(second).not.toBe(first);

    setSecretKey(dummy("sk", "test"));
    expect(getStripeClient()).not.toBe(second);
  });

  it("checks the key on every call, even when a client is cached", () => {
    setSecretKey(dummy("sk", "test"));
    getStripeClient();

    setDeployment("production", undefined);

    expect(thrownMessage(() => getStripeClient())).toBe("Stripe unavailable: TEST_KEY_IN_PRODUCTION");
  });
});

describe("stripeWebhookSecrets", () => {
  it("reads both secrets at call time", () => {
    expect(stripeWebhookSecrets()).toEqual({ platform: null, connect: null });

    const platform = "whsec_" + "p".repeat(24);
    const connect = "whsec_" + "c".repeat(24);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", platform);
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", connect);

    expect(stripeWebhookSecrets()).toEqual({ platform, connect });
  });

  it("returns null for a value that is not a webhook signing secret", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", dummy("sk", "test"));
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_");

    expect(stripeWebhookSecrets()).toEqual({ platform: null, connect: null });

    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", `whsec_${BODY} `);

    expect(stripeWebhookSecrets()).toEqual({ platform: null, connect: null });
  });
});

describe("payment gateway behind the key guard", () => {
  it("refuses every call before reaching Stripe when the key is refused", async () => {
    setDeployment("production", undefined);
    setSecretKey(dummy("sk", "test"));
    const gateway = getPaymentGateway();
    const refused = "Stripe unavailable: TEST_KEY_IN_PRODUCTION";

    await expect(gateway.createCheckoutSession({ mode: "payment" })).rejects.toThrow(refused);
    await expect(gateway.createConnectAccount({ type: "express" })).rejects.toThrow(refused);
    await expect(
      gateway.createAccountLink({ account: "acct_1", type: "account_onboarding" })
    ).rejects.toThrow(refused);
    await expect(gateway.createLoginLink("acct_1")).rejects.toThrow(refused);
    await expect(gateway.retrieveAccount("acct_1")).rejects.toThrow(refused);
  });
});
