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

function Controlled({ side, onCloseAutoFocus }: { side: Side; onCloseAutoFocus?: (event: Event) => void }) {
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

  it("se ferme par le bouton « Fermer » de 44 px", async () => {
    render(<Controlled side={side} />);
    const opener = open();
    const sheet = await screen.findByRole("dialog", { name: "Filtres" });
    const close = within(sheet).getByRole("button", { name: "Fermer" });
    expect(close).toHaveClass("size-11");

    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("porte les classes de son côté, des durées préfixées par l'état et aucune couleur en dur", async () => {
    render(<WithTrigger side={side} />);
    open();
    const sheet = await screen.findByRole("dialog", { name: "Filtres" });
    expect(sheet).toHaveClass(
      "bg-card",
      "text-card-foreground",
      "data-[state=open]:duration-300",
      "data-[state=closed]:duration-200",
      `data-[state=open]:slide-in-from-${side}`,
      `data-[state=closed]:slide-out-to-${side}`,
    );
    expect(sheet.className).not.toMatch(/(^|\s)duration-\d/);
    expect(sheet.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(sheet.getAttribute("style") ?? "").not.toMatch(/font-family/);

    const handle = sheet.querySelector('[aria-hidden="true"].h-1');
    if (side === "bottom") {
      expect(sheet).toHaveClass("rounded-t-sheet", "bottom-0");
      expect(handle).not.toBeNull();
    } else {
      expect(sheet).toHaveClass("right-0", "max-w-md");
      expect(handle).toBeNull();
    }
  });
});
