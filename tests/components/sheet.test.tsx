import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Side = "bottom" | "right";

function Body() {
  return (
    <>
      <SheetHeader>
        <SheetTitle>Filtres</SheetTitle>
        <SheetDescription>Affinez la liste des boucheries.</SheetDescription>
      </SheetHeader>
      <input aria-label="Ville" />
      <SheetFooter>
        <button type="button">Appliquer</button>
      </SheetFooter>
    </>
  );
}

function WithTrigger({ side }: { side: Side }) {
  return (
    <Sheet>
      <SheetTrigger>Ouvrir</SheetTrigger>
      <SheetContent side={side}>
        <Body />
      </SheetContent>
    </Sheet>
  );
}

function Controlled({
  side,
  onCloseAutoFocus,
}: {
  side: Side;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <button type="button">Ailleurs</button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} onCloseAutoFocus={onCloseAutoFocus}>
          <Body />
        </SheetContent>
      </Sheet>
    </>
  );
}

function open() {
  const opener = screen.getByRole("button", { name: "Ouvrir" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

function pressEscape() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
}

describe.each<Side>(["bottom", "right"])("Sheet côté %s", (side) => {
  it("s'ouvre nommé, focus à l'intérieur, défilement verrouillé ; Échap ferme et rend le focus au Trigger", async () => {
    render(<WithTrigger side={side} />);
    const trigger = open();
    const sheet = await screen.findByRole("dialog", { name: "Filtres" });
    expect(sheet).toHaveAccessibleDescription("Affinez la liste des boucheries.");
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect(document.body).toHaveAttribute("data-scroll-locked");

    pressEscape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("garde le focus à l'intérieur : Tab boucle aux deux extrémités", async () => {
    render(<WithTrigger side={side} />);
    open();
    const sheet = await screen.findByRole("dialog", { name: "Filtres" });
    const first = within(sheet).getByRole("textbox", { name: "Ville" });
    const last = within(sheet).getByRole("button", { name: "Fermer" });

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("sans Trigger, rend le focus au bouton qui l'a ouvert", async () => {
    render(<Controlled side={side} />);
    const opener = open();
    await screen.findByRole("dialog", { name: "Filtres" });

    pressEscape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("laisse gagner un onCloseAutoFocus de l'appelant qui appelle preventDefault", async () => {
    const onCloseAutoFocus = (event: Event) => {
      event.preventDefault();
      screen.getByRole("button", { name: "Ailleurs" }).focus();
    };
    render(<Controlled side={side} onCloseAutoFocus={onCloseAutoFocus} />);
    open();
    await screen.findByRole("dialog", { name: "Filtres" });

    pressEscape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ailleurs" }));
  });

  it("se ferme par le bouton « Fermer »", async () => {
    render(<Controlled side={side} />);
    const opener = open();
    const sheet = await screen.findByRole("dialog", { name: "Filtres" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});
