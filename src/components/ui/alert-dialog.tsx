"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { CENTERED_SURFACE_CLASSES } from "@/components/ui/overlay-surface";
import { useReturnFocus } from "@/components/ui/use-return-focus";

/*
 * Dialogue d'alerte (APG « alertdialog ») bâti sur @radix-ui/react-dialog :
 * rôle alertdialog, aucune fermeture par interaction extérieure, focus initial
 * sur « Annuler », pas de croix. Échap ferme (comportement attendu du patron).
 */

const AlertDialog = DialogPrimitive.Root;
const AlertDialogTrigger = DialogPrimitive.Trigger;

const CancelRefContext = React.createContext<React.MutableRefObject<HTMLButtonElement | null> | null>(null);

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

const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-subtitle text-foreground", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("mt-2 text-body text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex flex-wrap gap-3", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

type AlertDialogButtonProps = Omit<ButtonProps, "asChild" | "loading" | "variant"> & { loading?: boolean };

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogButtonProps>(
  ({ className, onClick, ...props }, forwardedRef) => {
    const cancelRef = React.useContext(CancelRefContext);
    const ref = React.useCallback(
      (node: HTMLButtonElement | null) => {
        if (cancelRef) cancelRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [cancelRef, forwardedRef],
    );
    return (
      <DialogPrimitive.Close asChild onClick={onClick}>
        <Button ref={ref} variant="outline" className={cn("flex-1", className)} {...props} />
      </DialogPrimitive.Close>
    );
  },
);
AlertDialogCancel.displayName = "AlertDialogCancel";

type AlertDialogActionProps = AlertDialogButtonProps & { variant?: "default" | "destructive" };

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, onClick, variant = "default", ...props }, ref) => (
    <DialogPrimitive.Close asChild onClick={onClick}>
      <Button ref={ref} variant={variant} className={cn("flex-1", className)} {...props} />
    </DialogPrimitive.Close>
  ),
);
AlertDialogAction.displayName = "AlertDialogAction";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
