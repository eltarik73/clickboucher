// Recorder standing for the Stripe gateway (src/lib/payments/gateway.ts) in integration tests.
//
// The gateway is the only stand-in allowed for Stripe (CLAUDE.md « Tests »): Prisma is never
// mocked. Every method records its call and rejects with `FakePaymentGateway: unexpected call
// <method>`, so a code path that starts calling Stripe fails instead of reaching the network. To
// prove that a path makes no Stripe call, assert that `calls` is empty.
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

export interface FakePaymentGateway extends PaymentGateway {
  calls: Array<{ method: GatewayMethod; args: unknown[] }>;
  reset(): void;
}

export function createFakePaymentGateway(): FakePaymentGateway {
  const calls: FakePaymentGateway["calls"] = [];
  const unexpected =
    (method: GatewayMethod) =>
    async (...args: unknown[]): Promise<never> => {
      calls.push({ method, args });
      throw new Error(`FakePaymentGateway: unexpected call ${method}`);
    };

  return {
    calls,
    reset() {
      calls.length = 0;
    },
    createCheckoutSession: unexpected("createCheckoutSession"),
    createConnectAccount: unexpected("createConnectAccount"),
    createAccountLink: unexpected("createAccountLink"),
    createLoginLink: unexpected("createLoginLink"),
    retrieveAccount: unexpected("retrieveAccount"),
  };
}
