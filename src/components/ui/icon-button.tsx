import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "text-foreground hover:bg-muted",
        subtle: "bg-muted text-foreground hover:bg-border",
        solid: "bg-primary text-primary-foreground hover:bg-primary-hover",
      },
      size: {
        md: "size-11",
        lg: "size-14",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

type IconButtonBase = {
  label: string;
  icon: React.ReactNode;
  variant?: "ghost" | "subtle" | "solid";
  size?: "md" | "lg";
  className?: string;
};

export type IconButtonProps =
  | (IconButtonBase &
      Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        "children" | "aria-label" | "aria-labelledby" | "className"
      > & { asChild?: false })
  | (IconButtonBase & { asChild: true; children: React.ReactElement });

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  if (props.asChild) {
    const { asChild, label, icon, variant, size, className, children, ...rest } = props;
    const child = React.Children.only(children);
    return (
      <Slot
        ref={ref}
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...rest}
      >
        {React.cloneElement(
          child,
          undefined,
          <span aria-hidden="true" className="inline-flex">
            {icon}
          </span>,
        )}
      </Slot>
    );
  }

  const { asChild, label, icon, variant, size, className, type = "button", ...rest } = props;
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </button>
  );
});
IconButton.displayName = "IconButton";

export { IconButton, iconButtonVariants };
