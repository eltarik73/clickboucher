import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Checkout is handled directly in /panier — redirect there
export default function CheckoutPage() {
  redirect("/panier");
}
