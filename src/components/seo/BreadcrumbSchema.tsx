import { JsonLd } from "@/components/seo/JsonLd";
import type { Crumb } from "@/lib/seo/breadcrumbs";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld/pages";

export function BreadcrumbSchema({ items }: { items: Crumb[] }) {
  return <JsonLd data={breadcrumbJsonLd(items)} />;
}
