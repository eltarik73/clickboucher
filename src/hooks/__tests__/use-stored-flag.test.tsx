import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useStoredFlag, type FlagStorage } from "@/hooks/use-stored-flag";

function Probe({ area, storageKey }: { area: FlagStorage; storageKey: string }) {
  const [value, setValue] = useStoredFlag(area, storageKey);
  return (
    <button type="button" onClick={() => setValue(!value)}>
      {value === null ? "inconnu" : String(value)}
    </button>
  );
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe("useStoredFlag", () => {
  it("is unknown in the server render, whatever the storage holds", () => {
    sessionStorage.setItem("flag", "true");
    expect(renderToString(<Probe area="session" storageKey="flag" />)).toContain("inconnu");
  });

  it("reads the session or local storage after mount", () => {
    sessionStorage.setItem("son", "true");
    localStorage.setItem("simple", "false");
    const session = render(<Probe area="session" storageKey="son" />);
    const local = render(<Probe area="local" storageKey="simple" />);
    expect(session.container).toHaveTextContent("true");
    expect(local.container).toHaveTextContent("false");
  });

  it("is false when nothing is stored, and the setter changes the state", () => {
    const { getByRole } = render(<Probe area="local" storageKey="absent" />);
    expect(getByRole("button")).toHaveTextContent("false");
    act(() => getByRole("button").click());
    expect(getByRole("button")).toHaveTextContent("true");
  });
});
