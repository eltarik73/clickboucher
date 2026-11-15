// Champ « prix au kilo » d'une option de découpe : le texte reste celui que le boucher tape, le
// parent reçoit des centimes entiers, et un prix changé par le parent (bouton de préréglage, ligne
// supprimée au-dessus) s'affiche aussitôt.
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CutOptionPriceInput, parseEuroDraft } from "@/components/boucher/CutOptionPriceInput";

const FIELD_NAME = "Prix au kilo de l'option Sans os";

function Harness({ initialCents }: { initialCents: number }) {
  const [priceCents, setPriceCents] = useState(initialCents);
  return (
    <>
      <CutOptionPriceInput
        priceCents={priceCents}
        onPriceCentsChange={setPriceCents}
        aria-label={FIELD_NAME}
      />
      <output aria-label="centimes du parent">{priceCents}</output>
      <button type="button" onClick={() => setPriceCents(990)}>
        Préréglage
      </button>
    </>
  );
}

function field(): HTMLInputElement {
  const input = screen.getByRole("textbox", { name: FIELD_NAME });
  if (!(input instanceof HTMLInputElement)) throw new Error("le champ n'est pas un <input>");
  return input;
}

function parentCents(): string | null {
  return screen.getByRole("status", { name: "centimes du parent" }).textContent;
}

function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

afterEach(cleanup);

describe("parseEuroDraft", () => {
  it.each([
    ["0.07", 7],
    ["19.99", 1999],
    ["100", 10000],
    ["12.50", 1250],
    ["12,5", 1250], // 12 € et 5 dixièmes = 1 200 + 50
    ["12.", 1200],
    [" 8 ", 800],
    [".5", 50], // le texte affiché est 0,50 € : le parent tient 50 centimes, pas 0
    ["99999.99", 9999999],
  ])("%j vaut %i centimes", (draft, cents) => {
    expect(parseEuroDraft(draft)).toBe(cents);
  });

  it.each([[""], ["."], [","], ["abc"], ["1.234"], ["123456"], ["-5"], ["1e3"], ["12.5.0"]])(
    "%j n'est pas un montant",
    (draft) => {
      expect(parseEuroDraft(draft)).toBeNull();
    }
  );
});

describe("CutOptionPriceInput", () => {
  it("affiche les centimes du parent en euros au premier rendu, vide pour 0", () => {
    render(<Harness initialCents={1250} />);
    expect(field().value).toBe("12.50");
    cleanup();

    render(<Harness initialCents={0} />);
    expect(field().value).toBe("");
  });

  it("garde chaque frappe telle quelle et finit à 1 250 centimes pour 12.50", () => {
    render(<Harness initialCents={0} />);

    type("1");
    expect([field().value, parentCents()]).toEqual(["1", "100"]);
    type("12");
    expect([field().value, parentCents()]).toEqual(["12", "1200"]);
    type("12.");
    expect([field().value, parentCents()]).toEqual(["12.", "1200"]);
    type("12.5");
    expect([field().value, parentCents()]).toEqual(["12.5", "1250"]);
    type("12.50");
    expect([field().value, parentCents()]).toEqual(["12.50", "1250"]);
  });

  it("accepte la virgule", () => {
    render(<Harness initialCents={0} />);

    type("12,5");

    expect([field().value, parentCents()]).toEqual(["12,5", "1250"]);
  });

  it("se vide (0 centime) puis se retape", () => {
    render(<Harness initialCents={1000} />);

    type("");
    expect([field().value, parentCents()]).toEqual(["", "0"]);
    type("8");
    expect([field().value, parentCents()]).toEqual(["8", "800"]);
  });

  it("ignore une frappe qui ne donne pas un montant", () => {
    render(<Harness initialCents={1250} />);

    type("abc");
    expect([field().value, parentCents()]).toEqual(["12.50", "1250"]);
    type("1.234");
    expect([field().value, parentCents()]).toEqual(["12.50", "1250"]);
    type("123456");
    expect([field().value, parentCents()]).toEqual(["12.50", "1250"]);
  });

  it("affiche un prix stocké au-delà de la saisie (6 chiffres d'euros) sans boucler", () => {
    render(<Harness initialCents={12345678} />);

    expect([field().value, parentCents()]).toEqual(["123456.78", "12345678"]);
  });

  it("affiche le prix que le parent pose de lui-même", () => {
    render(<Harness initialCents={1250} />);

    fireEvent.click(screen.getByRole("button", { name: "Préréglage" }));

    expect([field().value, parentCents()]).toEqual(["9.90", "990"]);
  });

  it("une ligne supprimée au-dessus ne laisse pas son texte à la ligne suivante (lignes indexées)", () => {
    function Rows() {
      const [rows, setRows] = useState([
        { name: "Avec os", priceCents: 1250 },
        { name: "Sans os", priceCents: 1890 },
      ]);
      return (
        <>
          {rows.map((row, idx) => (
            <CutOptionPriceInput
              key={idx}
              priceCents={row.priceCents}
              onPriceCentsChange={(cents) =>
                setRows(rows.map((r, i) => (i === idx ? { ...r, priceCents: cents } : r)))
              }
              aria-label={`Prix au kilo de l'option ${row.name}`}
            />
          ))}
          <button type="button" onClick={() => setRows(rows.slice(1))}>
            Retirer la première
          </button>
        </>
      );
    }
    render(<Rows />);
    fireEvent.change(screen.getByRole("textbox", { name: "Prix au kilo de l'option Avec os" }), {
      target: { value: "12.5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Retirer la première" }));

    expect(screen.getByRole("textbox", { name: "Prix au kilo de l'option Sans os" })).toHaveValue(
      "18.90"
    );
  });
});
