import * as React from "react";
import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent } from "@testing-library/dom";
import { Switch, SwitchField } from "@/components/ui/switch";

function Controlled(props: { disabled?: boolean; label?: string }) {
  const [checked, setChecked] = React.useState(false);
  return (
    <Switch
      checked={checked}
      onCheckedChange={setChecked}
      disabled={props.disabled}
      aria-label={props.label ?? "Notifications SMS"}
    />
  );
}

function ControlledField() {
  const [checked, setChecked] = React.useState(false);
  return (
    <SwitchField
      label="Mode vacances"
      description="La boutique n'accepte plus de commandes"
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}

describe("Switch", () => {
  test("role switch, aria-checked passe de false à true au clic", () => {
    render(<Controlled />);
    const sw = screen.getByRole("switch", { name: "Notifications SMS" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveAttribute("type", "button");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  test("désactivé, le clic n'appelle rien", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} disabled aria-label="Courriel" />);
    const sw = screen.getByRole("switch", { name: "Courriel" });
    expect(sw).toBeDisabled();
    fireEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("aria-labelledby et aria-describedby sont transmis", () => {
    render(
      <>
        <span id="lbl">Retrait express</span>
        <span id="desc">Commandes prêtes en 10 min</span>
        <Switch checked onCheckedChange={() => {}} aria-labelledby="lbl" aria-describedby="desc" />
      </>,
    );
    const sw = screen.getByRole("switch", { name: "Retrait express" });
    expect(sw).toHaveAccessibleDescription("Commandes prêtes en 10 min");
  });

  test("zone de clic de 44 px, anneau de focus opaque, couleurs par tokens", () => {
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={() => {}} aria-label="Option" />,
    );
    const sw = screen.getByRole("switch");
    // Piste border-2 : boîte de remplissage 40x20, décalages 2 px et 12 px -> zone de 44x44.
    expect(sw).toHaveClass(
      "relative",
      "border-2",
      "after:absolute",
      "after:-inset-x-0.5",
      "after:-inset-y-3",
      "focus-visible:ring-ring",
    );
    expect(sw).not.toHaveClass("after:inset-x-0", "after:-inset-y-2.5");
    expect(sw.className).not.toMatch(/ring-\S*\/\d+|#[0-9a-fA-F]{3,6}/);
    expect(sw).toHaveClass("bg-muted-foreground");
    rerender(<Switch checked onCheckedChange={() => {}} aria-label="Option" />);
    expect(sw).toHaveClass("bg-primary");
  });

  test("la className de l'appelant l'emporte", () => {
    render(<Switch checked onCheckedChange={() => {}} aria-label="Option" className="!bg-emerald-500" />);
    expect(screen.getByRole("switch")).toHaveClass("!bg-emerald-500");
  });
});

describe("SwitchField", () => {
  test("le libellé donne son nom au switch, un clic sur le libellé bascule", () => {
    render(<ControlledField />);
    const sw = screen.getByRole("switch", { name: "Mode vacances" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByText("Mode vacances"));
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  test("la description est référencée par aria-describedby", () => {
    render(<ControlledField />);
    const sw = screen.getByRole("switch", { name: "Mode vacances" });
    const desc = screen.getByText("La boutique n'accepte plus de commandes");
    expect(sw.getAttribute("aria-describedby")).toBe(desc.id);
    expect(sw).toHaveAccessibleDescription("La boutique n'accepte plus de commandes");
  });

  test("sans description, pas d'aria-describedby ; id fourni respecté", () => {
    render(<SwitchField id="pause" label="Pause" checked={false} onCheckedChange={() => {}} />);
    const sw = screen.getByRole("switch", { name: "Pause" });
    expect(sw).toHaveAttribute("id", "pause");
    expect(sw).not.toHaveAttribute("aria-describedby");
  });

  test("le libellé est obligatoire à la compilation", () => {
    // @ts-expect-error label est obligatoire
    const sansLibelle = <SwitchField checked={false} onCheckedChange={() => {}} />;
    expect(sansLibelle).toBeTruthy();
  });
});
