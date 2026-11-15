// @vitest-environment node
//
// When the customer's answer window of a price adjustment ends, as a reader that already holds the
// row decides it (the tracking page and its polled route close an unanswered adjustment only then).
// The same rule in SQL, expiredAdjustmentWhere, is exercised on PostgreSQL by
// tests/integration/orders/price-adjustment-answers.test.ts.
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_ANSWER_WINDOW_SECONDS,
  adjustmentAnswerDeadline,
  isAdjustmentAnswerDue,
} from "@/lib/pricing/tolerance";

const createdAt = new Date("2026-11-15T10:00:00.000Z");
const answerBy = new Date("2026-11-15T10:05:00.000Z");
const at = (iso: string) => new Date(iso);

describe("adjustmentAnswerDeadline", () => {
  it("is answerBy when the row has one", () => {
    expect(adjustmentAnswerDeadline({ answerBy, createdAt })).toEqual(answerBy);
  });

  it("is createdAt + 5 minutes on a row written before answerBy existed", () => {
    expect(ADJUSTMENT_ANSWER_WINDOW_SECONDS).toBe(300);
    expect(adjustmentAnswerDeadline({ answerBy: null, createdAt })).toEqual(
      at("2026-11-15T10:05:00.000Z")
    );
  });
});

describe("isAdjustmentAnswerDue", () => {
  const pending = { status: "PENDING", answerBy, createdAt };

  it("is false while the customer may still answer, true from the deadline on", () => {
    expect(isAdjustmentAnswerDue(pending, at("2026-11-15T10:04:59.999Z"))).toBe(false);
    expect(isAdjustmentAnswerDue(pending, answerBy)).toBe(true);
    expect(isAdjustmentAnswerDue(pending, at("2026-11-15T11:00:00.000Z"))).toBe(true);
  });

  it("measures an older row from its creation", () => {
    const legacy = { status: "PENDING", answerBy: null, createdAt };
    expect(isAdjustmentAnswerDue(legacy, at("2026-11-15T10:04:59.999Z"))).toBe(false);
    expect(isAdjustmentAnswerDue(legacy, at("2026-11-15T10:05:00.000Z"))).toBe(true);
  });

  it("is false for an adjustment that is no longer pending, and without adjustment", () => {
    const late = at("2026-11-15T12:00:00.000Z");
    for (const status of ["APPROVED", "AUTO_APPROVED", "REJECTED"]) {
      expect(isAdjustmentAnswerDue({ ...pending, status }, late)).toBe(false);
    }
    expect(isAdjustmentAnswerDue(null, late)).toBe(false);
  });
});
