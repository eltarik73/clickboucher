import { cn, formatPrice } from "@/lib/utils";

export interface PriceProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  cents: number;
  suffix?: string;
  struck?: boolean;
}

/** Montant affiché d'un bloc : formatPrice reste la seule règle de formatage. */
export function Price({ cents, suffix, struck = false, className, ...props }: PriceProps) {
  const text = formatPrice(cents) + (suffix ?? "");
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)} {...props}>
      {struck ? (
        <>
          <span className="sr-only">Ancien prix : </span>
          <s>{text}</s>
        </>
      ) : (
        text
      )}
    </span>
  );
}
