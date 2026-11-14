import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function Body() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifier la boutique</DialogTitle>
        <DialogDescription>Les changements sont visibles tout de suite.</DialogDescription>
      </DialogHeader>
      <input aria-label="Nom" />
      <button type="button">Enregistrer</button>
    </>
  );
}

function WithTrigger() {
  return (
    <Dialog>
      <DialogTrigger>Ouvrir</DialogTrigger>
      <DialogContent>
        <Body />
      </DialogContent>
    </Dialog>
  );
}

function Controlled(props: { onCloseAutoFocus?: (event: Event) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <button type="button">Ailleurs</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
          <Body />
        </DialogContent>
      </Dialog>
    </>
  );
}

function open(name: string) {
  const opener = screen.getByRole("button", { name });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

function pressEscape() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
}

describe("Dialog", () => {
  it("s'ouvre nommé, focus à l'intérieur, défilement verrouillé ; Échap ferme et rend le focus au Trigger", async () => {
    render(<WithTrigger />);
    const trigger = open("Ouvrir");
    const dialog = await screen.findByRole("dialog", { name: "Modifier la boutique" });
    expect(dialog).toHaveAccessibleDescription("Les changements sont visibles tout de suite.");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body).toHaveAttribute("data-scroll-locked");

    pressEscape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("garde le focus à l'intérieur : Tab boucle aux deux extrémités", async () => {
    render(<WithTrigger />);
    open("Ouvrir");
    const dialog = await screen.findByRole("dialog", { name: "Modifier la boutique" });
    const first = within(dialog).getByRole("textbox", { name: "Nom" });
    const last = within(dialog).getByRole("button", { name: "Fermer" });
    expect(dialog.lastElementChild).toBe(last);

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("sans Trigger, rend le focus au bouton qui l'a ouvert", async () => {
    render(<Controlled />);
    const opener = open("Ouvrir");
    await screen.findByRole("dialog", { name: "Modifier la boutique" });

    pressEscape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("laisse gagner un onCloseAutoFocus de l'appelant qui appelle preventDefault", async () => {
    const onCloseAutoFocus = (event: Event) => {
      event.preventDefault();
      screen.getByRole("button", { name: "Ailleurs" }).focus();
    };
    render(<Controlled onCloseAutoFocus={onCloseAutoFocus} />);
    open("Ouvrir");
    await screen.findByRole("dialog", { name: "Modifier la boutique" });

    pressEscape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ailleurs" }));
  });

  it("se ferme par le bouton « Fermer » de 44 px", async () => {
    render(<Controlled />);
    const opener = open("Ouvrir");
    const dialog = await screen.findByRole("dialog", { name: "Modifier la boutique" });
    const close = within(dialog).getByRole("button", { name: "Fermer" });
    expect(close).toHaveClass("size-11");

    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("porte les durées d'animation préfixées par l'état et les couleurs des tokens", async () => {
    render(<WithTrigger />);
    open("Ouvrir");
    const dialog = await screen.findByRole("dialog", { name: "Modifier la boutique" });
    expect(dialog).toHaveClass(
      "data-[state=open]:duration-200",
      "data-[state=closed]:duration-150",
      "bg-card",
      "text-card-foreground",
      "rounded-card",
    );
    expect(dialog.className).not.toMatch(/(^|\s)duration-\d/);
    expect(dialog.className).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("se centre par la mise en page, sans translate que l'animation d'entrée écraserait", async () => {
    render(<WithTrigger />);
    open("Ouvrir");
    const dialog = await screen.findByRole("dialog", { name: "Modifier la boutique" });
    expect(dialog).toHaveClass("fixed", "inset-0", "m-auto", "h-fit", "max-w-md", "max-h-[90dvh]", "overflow-y-auto");
    expect(dialog.className).not.toMatch(/translate-/);
  });
});
