// /webmaster/parametres shows the French sentence of an apiError answer in the root Toaster. Handing
// the envelope's `error` object to toast.error makes the Toaster throw « Objects are not valid as a
// React child » and takes the page down with it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import WebmasterParametresPage from "@/app/webmaster/parametres/page";

const FORBIDDEN_MESSAGE = "Accès réservé aux administrateurs";

function forbidden(): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code: "FORBIDDEN", message: FORBIDDEN_MESSAGE } }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => forbidden())
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/webmaster/parametres on an apiError answer", () => {
  it("shows the API's French message in the Toaster, never [object Object]", async () => {
    render(
      <ThemeProvider>
        <Toaster />
        <WebmasterParametresPage />
      </ThemeProvider>
    );

    // The configuration and the calendar loads both answered 403: one toast each.
    await waitFor(() => expect(screen.getAllByText(FORBIDDEN_MESSAGE)).toHaveLength(2));
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
