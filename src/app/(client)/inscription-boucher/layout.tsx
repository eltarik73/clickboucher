import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscription Boucher",
  description:
    "Inscrivez votre boucherie halal sur Klik&Go et commencez à recevoir des commandes en click & collect. Gestion simplifiée, tableau de bord dédié et visibilité en ligne.",
};

export default function InscriptionBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
