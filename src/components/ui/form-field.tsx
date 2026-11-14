import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FormFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "id" | "name" | "aria-invalid" | "aria-describedby"
  > {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  id?: string;
}

// Champ de saisie avec libellé visible. L'erreur vient de l'appelant (validation serveur) :
// ce composant ne valide rien, il relie et annonce.
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, name, error, hint, id, required, className, ...inputProps }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-erreur`;
    const hintId = `${inputId}-indice`;
    const describedBy = error ? errorId : hint ? hintId : undefined;

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
          aria-describedby={describedBy}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-caption text-destructive-text">
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="text-caption text-muted-foreground">
              {hint}
            </p>
          )
        )}
      </div>
    );
  },
);
FormField.displayName = "FormField";
