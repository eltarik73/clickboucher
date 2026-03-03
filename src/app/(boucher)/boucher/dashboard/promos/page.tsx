// Redirige vers le nouveau système d'offres
import { redirect } from "next/navigation";

export default function BoucherPromosRedirect() {
  redirect("/shop/offers");
}
