import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import { toast } from "sonner";
import {
  THEME_STORAGE_KEY,
  ThemeProvider,
  themeInitScript,
  useTheme,
} from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";

// La clé reste « theme » : c'est celle que les visiteurs ont déjà dans leur navigateur.
const KEY = "theme";

function runInitScript() {
  // Le script est exécuté tel que le navigateur l'exécute dans le <head>.
  new Function(themeInitScript)();
}

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

// React signale aussi l'erreur attendue par un événement « error » de jsdom.
function silenceExpectedError(event: ErrorEvent) {
  event.preventDefault();
}

beforeEach(() => {
  document.documentElement.className = "";
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.className = "";
  localStorage.clear();
});

describe("themeInitScript", () => {
  test("lit la clé historique « theme »", () => {
    expect(THEME_STORAGE_KEY).toBe(KEY);
  });

  test("pose la classe dark quand 'dark' est stocké", () => {
    localStorage.setItem(KEY, "dark");
    runInitScript();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("ne pose rien quand 'light' est stocké", () => {
    localStorage.setItem(KEY, "light");
    runInitScript();
    expect(document.documentElement.className).toBe("");
  });

  test("ne pose rien quand rien n'est stocké", () => {
    runInitScript();
    expect(document.documentElement.className).toBe("");
  });

  test("ne lève pas quand le stockage est inaccessible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(runInitScript).not.toThrow();
    expect(document.documentElement.className).toBe("");
  });
});

describe("ThemeProvider", () => {
  test("le montage n'écrit rien dans le stockage", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(screen.getByRole("button").textContent).toBe("light");
  });

  test("reprend la classe dark posée par le script sans la retirer", async () => {
    localStorage.setItem(KEY, "dark");
    runInitScript();
    // Toute disparition, même brève, de la classe produirait un flash clair :
    // chaque mutation garde la valeur précédente, qui doit toujours contenir dark.
    const classHistory: string[] = [];
    const record = (records: MutationRecord[]) => {
      for (const mutation of records) classHistory.push(mutation.oldValue ?? "");
    };
    const observer = new MutationObserver(record);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("dark"));
    record(observer.takeRecords());
    observer.disconnect();
    expect(classHistory.filter((value) => !value.split(" ").includes("dark"))).toEqual([]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("toggleTheme bascule la classe et mémorise le choix", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    const button = screen.getByRole("button");

    act(() => button.click());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("dark");
    expect(button.textContent).toBe("dark");

    act(() => button.click());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("light");
    expect(button.textContent).toBe("light");
  });

  test("useTheme hors du provider lève une erreur", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.addEventListener("error", silenceExpectedError);
    try {
      expect(() => render(<ThemeProbe />)).toThrow(
        "useTheme doit être utilisé dans ThemeProvider"
      );
    } finally {
      window.removeEventListener("error", silenceExpectedError);
    }
  });
});

describe("Toaster", () => {
  test("affiche les toasts dans le thème sombre quand la classe dark est posée", async () => {
    document.documentElement.classList.add("dark");
    render(
      <ThemeProvider>
        <Toaster />
      </ThemeProvider>
    );
    act(() => {
      toast("Commande envoyée");
    });
    const message = await screen.findByText("Commande envoyée");
    expect(message.closest('[data-theme="dark"]')).not.toBeNull();
  });
});
