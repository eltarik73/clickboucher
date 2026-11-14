import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div
        aria-hidden="true"
        className="mb-5 flex size-16 items-center justify-center rounded-card bg-muted text-muted-foreground"
      >
        {icon}
      </div>
      <Heading level={headingLevel ?? 2} size="subtitle" className="mb-2">
        {title}
      </Heading>
      {description ? (
        <p className="mb-6 max-w-xs text-body text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
