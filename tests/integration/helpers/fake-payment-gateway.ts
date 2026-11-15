// Fake of the Stripe gateway (src/lib/payments/gateway.ts) for integration tests.
//
// The gateway is the only stand-in allowed for Stripe (CLAUDE.md « Tests »): Prisma is never
// mocked. The fake records every call, answers what the test scripted with respond() (until reset),
// and rejects an unscripted call with `FakePaymentGateway: unexpected call <method>`. To prove that
// a code path makes no Stripe call, script nothing and assert that `calls` is empty.
//
// Install it before the code under test is imported:
//
//   const gateway = createFakePaymentGateway();
//   vi.mock("@/lib/payments/gateway", () => ({ getPaymentGateway: () => gateway }));
//
// The mock factory is hoisted above `gateway`, which is safe: it only returns a function that reads
// `gateway` when the code under test asks for the gateway. Call gateway.reset() in beforeEach.
import type { PaymentGateway } from "@/lib/payments/gateway";

type GatewayMethod = keyof PaymentGateway;
type GatewayResult<M extends GatewayMethod> = Awaited<ReturnType<PaymentGateway[M]>>;
type Script = { [M in GatewayMethod]?: GatewayResult<M> };

export interface FakePaymentGateway extends PaymentGateway {
  calls: Array<{ method: GatewayMethod; args: unknown[] }>;
  respond<M extends GatewayMethod>(method: M, value: GatewayResult<M>): void;
  reset(): void;
}

export function createFakePaymentGateway(): FakePaymentGateway {
  const calls: FakePaymentGateway["calls"] = [];
  let script: Script = {};

  async function answer<M extends GatewayMethod>(method: M, args: unknown[]): Promise<GatewayResult<M>> {
    calls.push({ method, args });
    const value = script[method];
    if (value === undefined) throw new Error(`FakePaymentGateway: unexpected call ${method}`);
    return value;
  }

  return {
    calls,
    respond(method, value) {
      script = { ...script, [method]: value };
    },
    reset() {
      calls.length = 0;
      script = {};
    },
    createCheckoutSession: (...args) => answer("createCheckoutSession", args),
    createConnectAccount: (...args) => answer("createConnectAccount", args),
    createAccountLink: (...args) => answer("createAccountLink", args),
    createLoginLink: (...args) => answer("createLoginLink", args),
    retrieveAccount: (...args) => answer("retrieveAccount", args),
  };
}
