// Visible "Mis à jour le X" timestamp — strong freshness signal for LLMs
// (Perplexity, ChatGPT) which favor recent content for citations.
// Uses semantic <time dateTime="..."> for both UX and machine readability.
// (audit GEO 2026 MED #16)
type Props = {
  /** ISO date string e.g. "2026-05-01" */
  date: string;
  className?: string;
};

export function LastUpdated({ date, className = "" }: Props) {
  const formatted = new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <p className={`text-[11px] text-gray-500 dark:text-gray-400 ${className}`}>
      Mis à jour le{" "}
      <time dateTime={date} className="tabular-nums">
        {formatted}
      </time>
    </p>
  );
}
