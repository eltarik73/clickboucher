// src/lib/api/json.ts — the type a client reads once a server value went through NextResponse.json.

/**
 * What JSON.stringify makes of T here: a Date becomes its ISO string, a bigint a number (through
 * the BigInt.prototype.toJSON installed by src/lib/api/errors.ts), and methods disappear.
 * Exact only when the route sends the service's value as it is.
 */
export type Serialized<T> = T extends Date
  ? string
  : T extends bigint
    ? number
    : T extends readonly (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? {
            [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: Serialized<
              T[K]
            >;
          }
        : T;
