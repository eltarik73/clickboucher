// Type test of Serialized<T> (src/lib/api/json.ts), checked by `npx tsc --noEmit` and never run by
// Vitest: what a client reads after NextResponse.json is the server type with its dates as ISO
// strings, its bigint as a number and its methods gone.
import type { Serialized } from "@/lib/api/json";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type ServerRow = {
  id: string;
  createdAt: Date;
  pickupSlotStart: Date | null;
  monthlyGmvCents: bigint;
  items: readonly { weightGrams: number | null; updatedAt: Date }[];
  label(): string;
};

type ClientRow = Serialized<ServerRow>;

export const serializedShape: [
  Equals<ClientRow["createdAt"], string>,
  Equals<ClientRow["pickupSlotStart"], string | null>,
  Equals<ClientRow["monthlyGmvCents"], number>,
  Equals<ClientRow["items"][number], { weightGrams: number | null; updatedAt: string }>,
  Equals<keyof ClientRow, "id" | "createdAt" | "pickupSlotStart" | "monthlyGmvCents" | "items">,
] = [true, true, true, true, true];

declare const received: ClientRow;
// @ts-expect-error a serialized date is an ISO string, never a Date
export const notADate: Date = received.createdAt;
