import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon panier | Klik&Go",
  description:
    "Consultez votre panier et finalisez votre commande click & collect chez votre boucher halal.",
};

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
