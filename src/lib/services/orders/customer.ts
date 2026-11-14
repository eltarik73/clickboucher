// src/lib/services/orders/customer.ts — the customer a quote or an order is computed for.
//
// The quote and the order resolve the signed-in customer the same way: a customer whose users row
// does not exist yet (signed in before the Clerk webhook ran) gets it created here, so the quote
// shown in the cart and the order placed from it see the same role, pro price and promo-code rights.
import { getOrCreateUser } from "@/lib/get-or-create-user";
import type { OrderCustomer } from "./quote";

/** The Prisma user behind a Clerk id, created when missing; null when Clerk does not know the id. */
export async function resolveOrderCustomer(clerkId: string): Promise<OrderCustomer | null> {
  const user = await getOrCreateUser(clerkId);
  if (user === null) return null;
  return {
    id: user.id,
    role: user.role,
    isGuest: user.isGuest,
    firstName: user.firstName,
    email: user.email,
  };
}
