import { redirect } from "next/navigation";

// Checkout is handled directly in /panier — redirect there
export default function CheckoutPage() {
  redirect("/panier");
}
