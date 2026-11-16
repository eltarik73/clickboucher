// Type contracts of the UI primitives, checked by `npx tsc --noEmit` and never run by Vitest. Each
// refused shape follows an accepted one that differs only by the prop under test, so the expected
// error can only come from that prop.
import type { ComponentProps } from "react";
import type { AlertDialogContent } from "@/components/ui/alert-dialog";
import type { ButtonProps } from "@/components/ui/button";
import type { FormFieldProps } from "@/components/ui/form-field";
import type { IconButtonProps } from "@/components/ui/icon-button";
import type { OrderStatusBadge, ShopStatusBadge } from "@/components/ui/status-badge";
import type { SwitchFieldProps } from "@/components/ui/switch";
import type { ORDER_STATUS_LABELS } from "@/lib/design-tokens";

type AlertDialogContentProps = ComponentProps<typeof AlertDialogContent>;
type OrderStatusBadgeProps = ComponentProps<typeof OrderStatusBadge>;
type ShopStatusBadgeProps = ComponentProps<typeof ShopStatusBadge>;

// asChild renders the caller's element, which has no loading state to show.
({ asChild: true }) satisfies ButtonProps;
({ loading: true }) satisfies ButtonProps;
// @ts-expect-error asChild and loading are exclusive
({ asChild: true, loading: true }) satisfies ButtonProps;

// A control without a visible text needs its name.
({ label: "Fermer", icon: null }) satisfies IconButtonProps;
// @ts-expect-error an IconButton without a label has no accessible name
({ icon: null }) satisfies IconButtonProps;

({ label: "Rue", name: "street" }) satisfies FormFieldProps;
// @ts-expect-error a FormField without a label has no visible label
({ name: "street" }) satisfies FormFieldProps;
// @ts-expect-error a FormField without a name is not submitted
({ label: "Rue" }) satisfies FormFieldProps;

({ label: "Mode vacances", checked: false, onCheckedChange: () => {} }) satisfies SwitchFieldProps;
// @ts-expect-error a SwitchField without a label has no accessible name
({ checked: false, onCheckedChange: () => {} }) satisfies SwitchFieldProps;

// The alert dialog owns its role and refuses dismissal by an outside interaction.
({ children: null }) satisfies AlertDialogContentProps;
// @ts-expect-error the role is always alertdialog
({ children: null, role: "dialog" }) satisfies AlertDialogContentProps;
// @ts-expect-error an outside interaction never closes an alert dialog
({ children: null, onInteractOutside: () => {} }) satisfies AlertDialogContentProps;

// Statuses are the Prisma enums, so a new status fails compilation where it lacks a label or tone.
({ status: "READY" }) satisfies OrderStatusBadgeProps;
// @ts-expect-error UNKNOWN is not an OrderStatus
({ status: "UNKNOWN" }) satisfies OrderStatusBadgeProps;
({ status: "OPEN" }) satisfies ShopStatusBadgeProps;
// @ts-expect-error UNKNOWN is not a ShopStatus
({ status: "UNKNOWN" }) satisfies ShopStatusBadgeProps;

export type ReadyLabel = (typeof ORDER_STATUS_LABELS)["READY"];
// @ts-expect-error the label map is keyed by OrderStatus: a plain string is not a key
export type AnyStringLabel = (typeof ORDER_STATUS_LABELS)[string];
