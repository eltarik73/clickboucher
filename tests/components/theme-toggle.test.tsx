import { afterEach, describe, expect, it } from "vitest";
import { render, act } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

afterEach(() => {
  document.documentElement.classList.remove("dark");
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("a un nom constant et expose son état par aria-pressed", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button", { name: "Mode sombre" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveClass("size-11");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByRole("button", { name: "Mode sombre" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("rend les deux icônes, choisies par CSS dès le premier rendu", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const icons = screen.getByRole("button", { name: "Mode sombre" }).querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveClass("dark:hidden");
    expect(icons[1]).toHaveClass("hidden", "dark:block");
  });
});
