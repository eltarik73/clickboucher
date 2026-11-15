// src/lib/cache/codec.ts — the JSON of the Redis entries of this folder. JSON has no date type:
// each Date is written as { $date: iso } and read back as a Date, so that a cached Prisma row has
// the types of the row read from the database.

const DATE_TAG = "$date";

/** The JSON text of `value`, each Date written as { $date: iso }. */
export function encodeCacheValue(value: unknown): string {
  // JSON.stringify applies Date.prototype.toJSON before the replacer: the Date itself is this[key].
  return JSON.stringify(
    value,
    function (this: Record<string, unknown>, key: string, json: unknown): unknown {
      const original = this[key];
      return original instanceof Date ? { [DATE_TAG]: original.toISOString() } : json;
    }
  );
}

function isTaggedDate(value: unknown): value is { [DATE_TAG]: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    DATE_TAG in value &&
    Object.keys(value).length === 1
  );
}

function reviveDate(_key: string, value: unknown): unknown {
  if (!isTaggedDate(value)) return value;
  const iso = value[DATE_TAG];
  const date = typeof iso === "string" ? new Date(iso) : null;
  // Typed as a Date by the reader, an unreadable date would fail later: the whole entry is refused.
  if (date === null || Number.isNaN(date.getTime())) {
    throw new RangeError("Unreadable date in a cache entry");
  }
  return date;
}

/**
 * The value of an entry with its dates as Date, or undefined when the entry is unreadable (not
 * JSON, or a tagged date that is not a date). `raw` is the JSON text, or the value @upstash/redis
 * already parsed, which it does on every read by default.
 */
export function decodeCacheValue(raw: unknown): unknown {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    return JSON.parse(text, reviveDate);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof RangeError) return undefined;
    throw error;
  }
}
