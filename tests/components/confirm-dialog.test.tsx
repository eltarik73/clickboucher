import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Variant = "danger" | "default";

function renderOpen(variant?: Variant) {
  const calls: string[] = [];
  const onConfirm = vi.fn(() => calls.push("confirm"));
  const onCancel = vi.fn(() => calls.push("cancel"));
  const onOpenChange = vi.fn((open: boolean) => calls.push(`open:${open}`));
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Vider le panier ?"
      description="Tous les articles seront retirés."
      variant={variant}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { calls, onConfirm, onCancel, onOpenChange };
}

function Stateful() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Vider
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Vider le panier ?"
        description="Tous les articles seront retirés."
        variant="danger"
        onConfirm={() => undefined}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("est un alertdialog nommé, libellés par défaut « Confirmer » et « Annuler »", async () => {
    renderOpen();
    const alert = await screen.findByRole("alertdialog", { name: "Vider le panier ?" });
    expect(alert).toHaveAccessibleDescription("Tous les articles seront retirés.");
    expect(within(alert).getByRole("button", { name: "Confirmer" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it.each<Variant>(["default", "danger"])("place le focus initial sur « Annuler » (%s)", async (variant) => {
    renderOpen(variant);
    const alert = await screen.findByRole("alertdialog");
    expect(document.activeElement).toBe(within(alert).getByRole("button", { name: "Annuler" }));
  });

  it("l'action appelle onConfirm puis onOpenChange(false), sans onCancel", async () => {
    const { calls, onCancel } = renderOpen("danger");
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Confirmer" }));
    expect(calls).toEqual(["confirm", "open:false"]);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("le bouton d'annulation appelle onCancel puis onOpenChange(false)", async () => {
    const { calls, onConfirm } = renderOpen();
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Annuler" }));
    expect(calls).toEqual(["cancel", "open:false"]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Échap ferme sans appeler onCancel ; un pointeur extérieur ne ferme pas", async () => {
    const { onCancel, onOpenChange } = renderOpen("danger");
    await screen.findByRole("alertdialog");
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("danger : icône d'alerte masquée aux lecteurs d'écran et action destructive", async () => {
    renderOpen("danger");
    const alert = await screen.findByRole("alertdialog");
    const icon = within(alert).getByTestId("confirm-dialog-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("bg-destructive-subtle", "text-destructive-text");
    const action = within(alert).getByRole("button", { name: "Confirmer" });
    expect(action).toHaveClass("bg-destructive");
    expect(action).not.toHaveClass("bg-primary");
  });

  it("default : pas d'icône et action primaire", async () => {
    renderOpen("default");
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).queryByTestId("confirm-dialog-icon")).toBeNull();
    const action = within(alert).getByRole("button", { name: "Confirmer" });
    expect(action).toHaveClass("bg-primary");
    expect(action).not.toHaveClass("bg-destructive");
  });

  it("aucune classe de couleur en dur", async () => {
    renderOpen("danger");
    const alert = await screen.findByRole("alertdialog");
    for (const element of [alert, ...Array.from(alert.querySelectorAll("*"))]) {
      expect(element.getAttribute("class") ?? "").not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("rend le focus au bouton qui l'a ouvert", async () => {
    render(<Stateful />);
    const opener = screen.getByRole("button", { name: "Vider" });
    opener.focus();
    fireEvent.click(opener);
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});
