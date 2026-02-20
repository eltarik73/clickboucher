import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes commandes | Klik&Go",
  description:
    "Suivez l'historique de vos commandes click & collect et recommandez facilement.",
};

export default function CommandesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
