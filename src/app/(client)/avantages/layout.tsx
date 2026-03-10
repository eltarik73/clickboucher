import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Programme Fidélité & Avantages",
  description:
    "Découvrez le programme de fidélité Klik&Go avec 3 paliers de récompenses. Gagnez des remises progressives à chaque commande dans votre boucherie halal préférée.",
  alternates: { canonical: `${SITE_URL}/avantages` },
};

export default function AvantagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
