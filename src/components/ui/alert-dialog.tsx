"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  CENTERED_SURFACE_CLASSES,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReturnFocus } from "@/components/ui/use-return-focus";

/*
 * Alert dialog (APG "alertdialog") built on @radix-ui/react-dialog: role alertdialog, no dismissal
 * by an outside interaction, initial focus on « Annuler », no close cross. Escape closes, as the
 * pattern expects.
 */

const AlertDialog = DialogPrimitive.Root;
const AlertDialogTrigger = DialogPrimitive.Trigger;

const CancelRefContext =
  React.createContext<React.MutableRefObject<HTMLButtonElement | null> | null>(null);

function preventDismiss(event: Event) {
  event.preventDefault();
}

const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  Omit<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    "role" | "onPointerDownOutside" | "onInteractOutside"
  >
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const focusHandlers = useReturnFocus({
    onOpenAutoFocus: (event) => {
      onOpenAutoFocus?.(event);
      const cancel = cancelRef.current;
      if (!event.defaultPrevented && cancel) {
        event.preventDefault();
        cancel.focus();
      }
    },
    onCloseAutoFocus,
  });
  return (
    <CancelRefContext.Provider value={cancelRef}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(CENTERED_SURFACE_CLASSES, "max-w-sm p-6", className)}
          {...props}
          role="alertdialog"
          onPointerDownOutside={preventDismiss}
          onInteractOutside={preventDismiss}
          {...focusHandlers}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </CancelRefContext.Provider>
  );
});
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex flex-wrap gap-3", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

type AlertDialogButtonProps = Omit<ButtonProps, "asChild" | "loading" | "variant">;

// Close asChild composes its ref with the Button's: the caller's ref and the content's initial
// focus target both reach the same button.
const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogButtonProps>(
  ({ className, onClick, ...props }, forwardedRef) => {
    const cancelRef = React.useContext(CancelRefContext);
    return (
      <DialogPrimitive.Close ref={forwardedRef} asChild onClick={onClick}>
        <Button ref={cancelRef} variant="outline" className={cn("flex-1", className)} {...props} />
      </DialogPrimitive.Close>
    );
  }
);
AlertDialogCancel.displayName = "AlertDialogCancel";

type AlertDialogActionProps = AlertDialogButtonProps & { variant?: "default" | "destructive" };

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, onClick, variant = "default", ...props }, ref) => (
    <DialogPrimitive.Close asChild onClick={onClick}>
      <Button ref={ref} variant={variant} className={cn("flex-1", className)} {...props} />
    </DialogPrimitive.Close>
  )
);
AlertDialogAction.displayName = "AlertDialogAction";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  DialogTitle as AlertDialogTitle,
  DialogDescription as AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
