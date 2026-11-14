"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { useReturnFocus } from "@/components/ui/use-return-focus";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

type SheetSide = "bottom" | "right";

const sideClasses: Record<SheetSide, string> = {
  bottom: cn(
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-sheet border-t",
    "pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
    "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  ),
  right: cn(
    "inset-y-0 right-0 h-full w-full max-w-md border-l",
    "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  ),
};

export type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: SheetSide;
};

const SheetContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side = "bottom", className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
    const focusHandlers = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed z-50 overflow-y-auto border-border bg-card p-5 text-card-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
            sideClasses[side],
            className,
          )}
          {...props}
          {...focusHandlers}
        >
          {side === "bottom" ? (
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
          ) : null}
          {children}
          <DialogPrimitive.Close asChild>
            <IconButton label="Fermer" icon={<X className="size-5" />} className="absolute right-3 top-3" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex flex-col gap-3", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("pr-12 font-display text-subtitle text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-caption text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
};
