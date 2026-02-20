import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon profil | Klik&Go",
  description:
    "Gérez votre profil, vos préférences et vos informations personnelles sur Klik&Go.",
};

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
