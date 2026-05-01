import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Programme Fidélité & Avantages",
  description:
    "Découvrez le programme de fidélité Klik&Go avec 3 paliers de récompenses.",
  alternates: { canonical: `${SITE_URL}/avantages` },
  // Private user-specific content (loyalty rewards). Not for public indexing.
  robots: { index: false, follow: true },
};

export default function AvantagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
