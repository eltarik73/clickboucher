// @vitest-environment node
//
// When the customer's answer window of a price adjustment ends, as a reader that already holds the
// row decides it (the tracking page and its polled route close an unanswered adjustment only then).
// The same rule in SQL, expiredAdjustmentWhere, is exercised on PostgreSQL by
// tests/integration/orders/price-adjustment-answers.test.ts.
import type { AdjustmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { adjustmentAnswerDeadline, isAdjustmentAnswerDue } from "@/lib/pricing/tolerance";

const at = (iso: string) => new Date(iso);
const createdAt = at("2026-11-15T10:00:30.000Z");
const answerBy = at("2026-11-15T10:05:00.000Z");

describe("adjustmentAnswerDeadline", () => {
  it("is answerBy when the row has one", () => {
    expect(adjustmentAnswerDeadline({ answerBy, createdAt })).toEqual(answerBy);
  });

  it("is createdAt + 5 minutes on a row without answerBy", () => {
    expect(adjustmentAnswerDeadline({ answerBy: null, createdAt })).toEqual(
      at("2026-11-15T10:05:30.000Z")
    );
  });
});

describe("isAdjustmentAnswerDue", () => {
  const pending = { status: "PENDING" as const, answerBy, createdAt };
  const legacy = { ...pending, answerBy: null };

  it.each([
    ["a pending row 1 ms before answerBy", false, "2026-11-15T10:04:59.999Z", pending],
    ["a pending row at answerBy", true, "2026-11-15T10:05:00.000Z", pending],
    ["a pending row an hour later", true, "2026-11-15T11:00:00.000Z", pending],
    [
      "a row without answerBy 1 ms before createdAt + 5 min",
      false,
      "2026-11-15T10:05:29.999Z",
      legacy,
    ],
    ["a row without answerBy at createdAt + 5 min", true, "2026-11-15T10:05:30.000Z", legacy],
  ])("is due for %s: %s", (_label, expected, now, adjustment) => {
    expect(isAdjustmentAnswerDue(adjustment, at(now))).toBe(expected);
  });

  it.each<AdjustmentStatus>([
    "AUTO_APPROVED",
    "APPROVED",
    "REJECTED",
    "AUTO_VALIDATED",
    "ESCALATED",
  ])("is false for a row %s, long after its deadline", (status) => {
    expect(isAdjustmentAnswerDue({ ...pending, status }, at("2026-11-15T12:00:00.000Z"))).toBe(
      false
    );
  });

  it("is false without adjustment", () => {
    expect(isAdjustmentAnswerDue(null, at("2026-11-15T12:00:00.000Z"))).toBe(false);
  });
});
