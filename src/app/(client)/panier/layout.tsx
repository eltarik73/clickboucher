import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon panier",
  description:
    "Consultez votre panier et finalisez votre commande click & collect chez votre boucher halal.",
  robots: { index: false, follow: false },
};

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
