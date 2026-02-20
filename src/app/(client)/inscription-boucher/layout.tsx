import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscription Boucher | Klik&Go",
  description:
    "Inscrivez votre boucherie sur Klik&Go et commencez à recevoir des commandes click & collect.",
};

export default function InscriptionBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
