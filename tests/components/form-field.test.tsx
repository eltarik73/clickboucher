import * as React from "react";
import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

const FONT_SIZE_CLASS = /(^|\s)text-(xs|sm|caption|micro|body)(\s|$)/;

describe("FormField", () => {
  test("le libellé visible est relié au champ", () => {
    render(<FormField label="Adresse e-mail" name="email" type="email" />);
    const input = screen.getByLabelText("Adresse e-mail");
    expect(input.tagName).toBe("INPUT");
    expect(screen.getByText("Adresse e-mail").tagName).toBe("LABEL");
  });

  test("name et autoComplete atteignent le champ", () => {
    render(<FormField label="Téléphone" name="phone" autoComplete="tel" type="tel" />);
    const input = screen.getByLabelText("Téléphone");
    expect(input).toHaveAttribute("name", "phone");
    expect(input).toHaveAttribute("autocomplete", "tel");
    expect(input).toHaveAttribute("type", "tel");
  });

  test("required pose required et aria-required, l'astérisque est masqué", () => {
    const { container } = render(<FormField label="Prénom" name="firstName" required />);
    const input = screen.getByLabelText("Prénom", { exact: false });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-required", "true");
    const star = container.querySelector("label [aria-hidden='true']");
    expect(star?.textContent).toContain("*");
    expect(input).toHaveAccessibleName("Prénom");
  });

  test("sans required, ni required ni aria-required", () => {
    render(<FormField label="Société" name="company" />);
    const input = screen.getByLabelText("Société");
    expect(input).not.toBeRequired();
    expect(input).not.toHaveAttribute("aria-required");
  });

  test("une erreur est reliée, annoncée et rend le champ invalide", () => {
    render(
      <FormField
        label="Code postal"
        name="zip"
        hint="5 chiffres"
        error="Code postal invalide"
      />,
    );
    const input = screen.getByLabelText("Code postal");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Code postal invalide");
    const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toContain(alert.id);
    expect(input).toHaveAccessibleDescription(expect.stringContaining("Code postal invalide"));
    expect(screen.queryByText("5 chiffres")).toBeNull();
  });

  test("un indice seul est relié, sans alerte ni aria-invalid", () => {
    render(<FormField label="Mot-clé" name="q" hint="Au moins 3 lettres" />);
    const input = screen.getByLabelText("Mot-clé");
    const hint = screen.getByText("Au moins 3 lettres");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(hint.id);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  test("sans indice ni erreur, pas d'aria-describedby", () => {
    render(<FormField label="Ville" name="city" />);
    expect(screen.getByLabelText("Ville")).not.toHaveAttribute("aria-describedby");
  });

  test("l'id fourni est utilisé par le champ et le libellé", () => {
    render(<FormField label="Nom" name="lastName" id="nom-client" />);
    expect(screen.getByLabelText("Nom")).toHaveAttribute("id", "nom-client");
  });

  test("le champ est en 16 px (text-base), sans classe de taille plus petite", () => {
    render(<FormField label="Rue" name="street" />);
    const input = screen.getByLabelText("Rue");
    expect(input.className).toMatch(/(^|\s)text-base(\s|$)/);
    expect(input.className).not.toMatch(FONT_SIZE_CLASS);
  });

  test("className va à l'enveloppe, pas au champ", () => {
    const { container } = render(<FormField label="Rue" name="street" className="mt-4" />);
    expect(container.firstElementChild).toHaveClass("mt-4");
    expect(screen.getByLabelText("Rue")).not.toHaveClass("mt-4");
  });

  test("la ref atteint le champ", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<FormField ref={ref} label="Rue" name="street" />);
    expect(ref.current).toBe(screen.getByLabelText("Rue"));
  });

  test("le libellé et le nom sont obligatoires à la compilation", () => {
    // @ts-expect-error label est obligatoire
    const sansLibelle = <FormField name="street" />;
    // @ts-expect-error name est obligatoire
    const sansNom = <FormField label="Rue" />;
    expect(sansLibelle).toBeTruthy();
    expect(sansNom).toBeTruthy();
  });
});

describe("Input", () => {
  test("16 px, rayon de contrôle, bordure d'erreur et anneau de focus opaque", () => {
    render(<Input aria-label="Recherche" />);
    const input = screen.getByLabelText("Recherche");
    expect(input).toHaveClass(
      "text-base",
      "rounded-control",
      "aria-[invalid=true]:border-destructive",
      "focus-visible:ring-ring",
    );
    expect(input.className).not.toMatch(FONT_SIZE_CLASS);
  });

  test("une taille passée par l'appelant l'emporte", () => {
    render(<Input aria-label="Petit" className="text-sm" />);
    const input = screen.getByLabelText("Petit");
    expect(input).toHaveClass("text-sm");
    expect(input).not.toHaveClass("text-base");
  });
});
