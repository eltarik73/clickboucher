import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "name" | "aria-invalid" | "aria-describedby"
> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  id?: string;
}

// The error comes from the caller (server validation): this field validates nothing, it links
// and announces.
const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, name, error, hint, id, required, className, ...inputProps }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    // One message under the field: the error replaces the hint and is the only one announced.
    let message: React.ComponentPropsWithoutRef<"p"> | null = null;
    if (error) {
      message = {
        id: `${inputId}-error`,
        role: "alert",
        className: "text-caption text-destructive-text",
        children: error,
      };
    } else if (hint) {
      message = {
        id: `${inputId}-hint`,
        className: "text-caption text-muted-foreground",
        children: hint,
      };
    }

    return (
      <div className={cn("space-y-1.5", className)}>
        <label htmlFor={inputId} className="block text-caption font-semibold text-foreground">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        <Input
          {...inputProps}
          ref={ref}
          id={inputId}
          name={name}
          required={required}
          aria-required={required ? true : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={message?.id}
        />
        {message && <p {...message} />}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
