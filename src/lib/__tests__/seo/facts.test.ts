// @vitest-environment node
//
// The commercial facts every SEO page, FAQ JSON-LD and metadata repeats. They must stay true
// (payment at pickup, no service fee, click and collect only, certification by each shop) and
// none may carry a forbidden claim.

import { describe, it, expect } from "vitest";
import {
  COMMON_FAQ,
  FACT_FEES,
  FACT_HALAL,
  FACT_PAYMENT,
  FACT_PICKUP,
  FACT_SUMMARY_SHORT,
  ORDER_STEPS,
} from "@/lib/seo/facts";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { serviceFeeCentsFor } from "@/lib/pricing/totals";

const FACTS = { FACT_PAYMENT, FACT_FEES, FACT_PICKUP, FACT_HALAL, FACT_SUMMARY_SHORT };

function allTexts(): string[] {
  return [
    ...Object.values(FACTS),
    ...ORDER_STEPS.flatMap((step) => [step.title, step.text]),
    ...Object.values(COMMON_FAQ).flatMap((faq) => [faq.question, faq.answer]),
  ];
}

describe("SEO facts", () => {
  it("states « sans frais de service » only while an order paid at pickup carries no fee", () => {
    // A future fee must force this sentence (and every page that repeats it) to be revisited.
    expect(serviceFeeCentsFor("ON_PICKUP")).toBe(0);
    expect(FACT_FEES).toContain("sans frais de service");
    expect(COMMON_FAQ.fees.answer).toContain(FACT_FEES);
  });

  it("carries no forbidden claim in any fact, step, question or answer", () => {
    for (const text of allTexts()) {
      expect(findForbiddenClaims(text), text).toEqual([]);
    }
  });

  it("keeps the payment fact on payment in the shop, at pickup", () => {
    expect(FACT_PAYMENT).toMatch(/boucherie/);
    expect(FACT_PAYMENT).toMatch(/retrait/);
    expect(COMMON_FAQ.payment.answer).toContain(FACT_PAYMENT);
  });

  it("answers the delivery question with a negation and the pickup fact", () => {
    expect(COMMON_FAQ.delivery.answer).toMatch(/(pas de|sans|aucune) livraison/i);
    expect(COMMON_FAQ.delivery.answer).toContain(FACT_PICKUP);
  });

  it("leaves the halal certification to each shop", () => {
    expect(FACT_HALAL).toMatch(/chaque boucherie/i);
    expect(COMMON_FAQ.halal.answer).toContain(FACT_HALAL);
  });

  it("keeps the short summary within 60 characters", () => {
    expect(FACT_SUMMARY_SHORT.length).toBeLessThanOrEqual(60);
    expect(FACT_SUMMARY_SHORT.length).toBeGreaterThan(0);
  });

  it("describes the order in three steps, none promising online payment", () => {
    expect(ORDER_STEPS).toHaveLength(3);
    for (const step of ORDER_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.text.length).toBeGreaterThan(0);
    }
    expect(ORDER_STEPS.map((step) => step.text).join(" ")).toMatch(/sur place|en boutique/);
  });

  it("writes French with accents and without typographic leftovers", () => {
    for (const text of allTexts()) {
      expect(text, text).not.toMatch(/\s{2,}|^\s|\s$/);
    }
    expect(allTexts().join(" ")).toMatch(/é/);
  });
});
