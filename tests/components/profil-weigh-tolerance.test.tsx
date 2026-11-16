// /profil, section « Marge de pesée » : le choix enregistré est affiché, rien n'est coché pour qui
// n'a jamais choisi, l'enregistrement passe par PATCH /api/users/me { weighTolerance } seul.
// La page entière : enregistrer les préférences garde les sections que PATCH ne renvoie pas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import ProfilPage from "@/app/(client)/profil/page";
import WeighToleranceSetting from "@/app/(client)/profil/WeighToleranceSetting";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: { id: "user_profil" } }),
  useClerk: () => ({ signOut: vi.fn(), openUserProfile: vi.fn() }),
}));

const SAVE = "Enregistrer ma marge";
const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  toast.success.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("profil : marge de pesée", () => {
  it("jamais choisie : rien de coché, rien à enregistrer, aucun appel", () => {
    render(<WeighToleranceSetting initial={null} />);

    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.getByRole("button", { name: SAVE })).toBeDisabled();
    expect(screen.queryByText("Votre choix enregistré")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("le choix enregistré est coché et signalé ; le bouton ne sert qu'à un changement", () => {
    render(<WeighToleranceSetting initial="STANDARD" />);

    const standard = screen.getByRole("radio", { name: /^5\u00a0% du total estimé/ });
    expect(standard).toBeChecked();
    expect(standard).toHaveAccessibleName(/Votre choix enregistré$/);
    expect(screen.getByRole("button", { name: SAVE })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ }));
    expect(screen.getByRole("button", { name: SAVE })).toBeEnabled();
  });

  it("enregistrer : PATCH du seul choix, toast, le nouveau choix devient le choix enregistré", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { success: true, data: { weighTolerance: "EXTENDED" } })
    );
    render(<WeighToleranceSetting initial="STANDARD" />);

    fireEvent.click(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weighTolerance: "EXTENDED" }),
    });
    expect(toast.success).toHaveBeenCalledWith("Marge de pesée enregistrée");
    expect(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ })).toHaveAccessibleName(
      /Votre choix enregistré$/
    );
    expect(screen.getByRole("button", { name: SAVE })).toBeDisabled();
  });

  it("refus du serveur : son message s'affiche, l'ancien choix reste le choix enregistré", async () => {
    fetchMock.mockResolvedValue(
      reply(429, { success: false, error: { code: "RATE_LIMITED", message: "Trop de requêtes" } })
    );
    render(<WeighToleranceSetting initial="STANDARD" />);

    fireEvent.click(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Trop de requêtes");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /^5\u00a0% du total estimé/ })).toHaveAccessibleName(
      /Votre choix enregistré$/
    );
  });

  it("200 sans l'enveloppe de succès : le choix n'est pas tenu pour enregistré", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: {} }));
    render(<WeighToleranceSetting initial="STANDARD" />);

    fireEvent.click(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Votre choix n'a pas été enregistré. Réessayez."
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("panne réseau : un message, le choix reste modifiable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<WeighToleranceSetting initial={null} />);

    fireEvent.click(screen.getByRole("radio", { name: /^5\u00a0% du total estimé/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Erreur réseau : votre choix n'est pas enregistré. Réessayez."
    );
    expect(screen.getByRole("radio", { name: /^10\u00a0% du total estimé/ })).toBeEnabled();
  });
});

describe("profil : la page entière", () => {
  const PROFILE = {
    id: "u1",
    clerkId: "user_profil",
    email: "fatima@example.test",
    phone: null,
    firstName: "Fatima",
    lastName: "Amrani",
    role: "CLIENT",
    companyName: null,
    siret: null,
    proStatus: null,
    notifEmail: true,
    notifSms: false,
    notifWhatsapp: false,
    weighTolerance: "STANDARD",
    proAccesses: [],
    favoriteShops: [
      { id: "s1", name: "Boucherie du Marché", slug: "marche", imageUrl: null, city: "Chambéry" },
    ],
  };

  it("enregistrer les préférences garde les favoris : PATCH ne renvoie que la ligne users", async () => {
    const { favoriteShops: _favorites, proAccesses: _accesses, ...usersRow } = PROFILE;
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "PATCH"
        ? reply(200, { success: true, data: { ...usersRow, updatedAt: "2026-11-15T10:00:00Z" } })
        : reply(200, { success: true, data: PROFILE })
    );
    render(<ProfilPage />);
    expect(await screen.findByText("Boucherie du Marché")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer les préférences" }));
    });

    expect(toast.success).toHaveBeenCalledWith("Préférences enregistrées");
    expect(screen.getByRole("heading", { name: "Boucheries favorites" })).toBeInTheDocument();
    expect(screen.getByText("Boucherie du Marché")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zone dangereuse" })).toBeInTheDocument();
  });
});
