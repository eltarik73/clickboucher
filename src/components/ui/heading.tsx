import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type HeadingLevel = 1 | 2 | 3 | 4;
type HeadingSize = "hero" | "title" | "subtitle" | "section";

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: HeadingLevel;
  size?: HeadingSize;
}

const DEFAULT_SIZE: Record<HeadingLevel, HeadingSize> = {
  1: "title",
  2: "subtitle",
  3: "section",
  4: "section",
};

const SIZE_CLASSES: Record<HeadingSize, string> = {
  hero: "font-display text-hero text-balance",
  title: "font-display text-title text-balance",
  subtitle: "font-display text-subtitle text-balance",
  section: "text-body-lg font-semibold",
};

/** Titre : le niveau suit la structure du document, la taille suit le visuel. */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, size, className, ...props }, ref) => {
    const Tag = `h${level}` as const;
    return (
      <Tag
        ref={ref}
        className={cn("text-foreground", SIZE_CLASSES[size ?? DEFAULT_SIZE[level]], className)}
        {...props}
      />
    );
  },
);
Heading.displayName = "Heading";
