import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function Harness(props: { onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Refuser la commande
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Refuser la commande ?</AlertDialogTitle>
          <AlertDialogDescription>Le client sera prévenu.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={props.onAction}>
              Refuser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function open() {
  const opener = screen.getByRole("button", { name: "Refuser la commande" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("AlertDialog", () => {
  it("a le rôle alertdialog, un nom, une description, et le focus sur « Annuler »", async () => {
    render(<Harness />);
    open();
    const alert = await screen.findByRole("alertdialog", { name: "Refuser la commande ?" });
    expect(alert).toHaveAccessibleDescription("Le client sera prévenu.");
    expect(document.activeElement).toBe(within(alert).getByRole("button", { name: "Annuler" }));
    expect(within(alert).queryByRole("button", { name: "Fermer" })).toBeNull();
    expect(document.body).toHaveAttribute("data-scroll-locked");
  });

  it("ne se ferme pas sur un pointeur à l'extérieur", async () => {
    render(<Harness />);
    open();
    await screen.findByRole("alertdialog");
    fireEvent.pointerDown(document.body);
    fireEvent.focusIn(document.body);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("Échap ferme et rend le focus à l'ouvreur", async () => {
    render(<Harness />);
    const opener = open();
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("garde le focus à l'intérieur : Tab boucle aux deux extrémités", async () => {
    render(<Harness />);
    open();
    const alert = await screen.findByRole("alertdialog");
    const cancel = within(alert).getByRole("button", { name: "Annuler" });
    const action = within(alert).getByRole("button", { name: "Refuser" });
    action.focus();
    fireEvent.keyDown(action, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(action);
  });

  it("un clic sur l'action ferme", async () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    const opener = open();
    const alert = await screen.findByRole("alertdialog");
    const action = within(alert).getByRole("button", { name: "Refuser" });
    expect(action).toHaveClass("bg-destructive");
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("l'action ne ferme pas si son onClick appelle preventDefault", async () => {
    render(<Harness onAction={(event) => event.preventDefault()} />);
    open();
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Refuser" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("le bouton d'annulation ferme", async () => {
    render(<Harness />);
    open();
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("se centre par la mise en page, sans translate que l'animation d'entrée écraserait", async () => {
    render(<Harness />);
    open();
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveClass("fixed", "inset-0", "m-auto", "h-fit", "max-w-sm", "p-6");
    expect(alert.className).not.toMatch(/translate-/);
  });

  it("le pied passe à la ligne : des libellés longs s'empilent au lieu de déborder", async () => {
    render(<Harness />);
    open();
    const alert = await screen.findByRole("alertdialog");
    const footer = within(alert).getByRole("button", { name: "Annuler" }).parentElement;
    expect(footer).toHaveClass("flex", "flex-wrap", "gap-3");
  });

  it("refuse un rôle ou une fermeture extérieure passés par l'appelant", () => {
    const misuse = (
      // @ts-expect-error le rôle est toujours alertdialog
      <AlertDialogContent role="dialog">
        <AlertDialogTitle>Titre</AlertDialogTitle>
      </AlertDialogContent>
    );
    expect(misuse).toBeTruthy();
  });
});
