import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SEO_CITIES } from "@/lib/seo/cities";
import { partnerPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { partnerDescription, partnerTitle } from "@/lib/seo/titles";

// Partner pages are business-critical: they stay indexable whatever the number of shops in the
// city (rule OR of the seo-anti-penalty skill), so this metadata sets no robots and states no
// shop count. Title and description come from the shared builders (src/lib/seo/titles.ts).
export async function generateMetadata({
  params,
}: {
  params: { ville: string };
}): Promise<Metadata> {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) notFound();

  const title = partnerTitle(city);
  const description = partnerDescription(city);
  const url = absoluteUrl(partnerPath(city.slug));

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Klik&Go",
      locale: "fr_FR",
      type: "website",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `Devenir partenaire boucher Klik&Go à ${city.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default function DevenirBoucherPartenaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
