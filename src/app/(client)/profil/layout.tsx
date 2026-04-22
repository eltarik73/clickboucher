import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon profil",
  description:
    "Gérez votre profil, vos préférences et vos informations personnelles sur Klik&Go.",
  robots: { index: false, follow: false },
};

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
