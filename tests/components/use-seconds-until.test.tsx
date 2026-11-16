// The countdown of a customer's answer window, shared by his banner and the butcher's kitchen card:
// no clock read before mount (the server render shows no time), one tick per second, a stop at 0
// and on unmount, nothing at all without a deadline.
import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMinutesSeconds, useSecondsUntil } from "@/hooks/use-seconds-until";

const NOW = Date.parse("2026-11-16T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

function Probe({ deadlineMs }: { deadlineMs: number | null }) {
  return <span>{String(useSecondsUntil(deadlineMs))}</span>;
}

describe("useSecondsUntil", () => {
  it("reads no clock before mount: the server render gets null", () => {
    expect(renderToString(<Probe deadlineMs={NOW + 60_000} />)).toBe("<span>null</span>");
  });

  it("counts the whole seconds left, rounded up, one tick per second", () => {
    const { result } = renderHook(() => useSecondsUntil(NOW + 4 * 60_000 + 4_500));
    expect(result.current).toBe(245);

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(244);
  });

  it("stops at 0 and clears its interval", () => {
    const { result } = renderHook(() => useSecondsUntil(NOW + 2_000));

    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is 0 at once for a deadline already passed, with no interval", () => {
    const { result } = renderHook(() => useSecondsUntil(NOW - 1_000));

    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its interval on unmount", () => {
    const { unmount } = renderHook(() => useSecondsUntil(NOW + 60_000));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is null without a deadline, and back to null when the deadline goes", () => {
    const { result, rerender } = renderHook<number | null, { deadlineMs: number | null }>(
      ({ deadlineMs }) => useSecondsUntil(deadlineMs),
      { initialProps: { deadlineMs: NOW + 60_000 } }
    );
    expect(result.current).toBe(60);

    rerender({ deadlineMs: null });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("formatMinutesSeconds", () => {
  it.each([
    [245, "4:05"],
    [60, "1:00"],
    [9, "0:09"],
    [0, "0:00"],
  ])("%i s -> %s", (seconds, text) => {
    expect(formatMinutesSeconds(seconds)).toBe(text);
  });
});
