// @vitest-environment node
//
// The status of a butcher's Stripe Connect account (Shop.stripeAccountStatus), decided in one place
// (src/lib/services/stripe/account-state.ts) for the webhook and for the butcher's refresh.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { connectAccountState } from "@/lib/services/stripe/account-state";

const ROOT = path.resolve(__dirname, "../../..");

describe("connectAccountState", () => {
  it("is active when the account takes payments and receives payouts", () => {
    expect(
      connectAccountState({
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { past_due: ["external_account"], disabled_reason: "requirements.past_due" },
      })
    ).toBe("active");
  });

  it("is restricted when Stripe blocked it: overdue requirements or a disabled reason", () => {
    expect(
      connectAccountState({
        charges_enabled: true,
        payouts_enabled: false,
        requirements: { past_due: ["individual.verification.document"], disabled_reason: null },
      })
    ).toBe("restricted");
    expect(
      connectAccountState({
        charges_enabled: false,
        payouts_enabled: false,
        requirements: { past_due: [], disabled_reason: "rejected.fraud" },
      })
    ).toBe("restricted");
  });

  it("is pending while the onboarding is not finished", () => {
    expect(
      connectAccountState({
        charges_enabled: false,
        payouts_enabled: false,
        requirements: { past_due: [], disabled_reason: null },
      })
    ).toBe("pending");
    expect(connectAccountState({ charges_enabled: true, payouts_enabled: false })).toBe("pending");
    expect(connectAccountState({})).toBe("pending");
    expect(
      connectAccountState({ charges_enabled: null, payouts_enabled: null, requirements: null })
    ).toBe("pending");
  });

  it("is the rule of both readers: neither the webhook nor the refresh decides it again", () => {
    for (const file of [
      "src/lib/services/stripe/connect.ts",
      "src/lib/services/stripe/webhook/account-events.ts",
    ]) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      expect(source, file).toMatch(
        /import \{[^}]*\bconnectAccountState\b[^}]*\} from "\.{1,2}\/account-state"/
      );
      // "restricted" is a decision of the rule alone ("active" also names a card capability).
      expect(source, file).not.toContain('"restricted"');
    }
  });
});
