"use client";

// Interrupteur « Envoi des e-mails commerciaux » (/webmaster/parametres, page réservée aux admins).
// L'état affiché est toujours celui du serveur : lu au montage, remplacé par la réponse du PUT,
// jamais deviné ni posé d'avance. Tant qu'il n'est pas connu, aucun interrupteur n'est affiché.
import { useEffect, useId, useState, type JSX } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { refusalMessageOf } from "@/lib/api/client-refusal";

const ENDPOINT = "/api/webmaster/commercial-emails";
const LOAD_ERROR = "Le réglage n'a pas pu être chargé.";
const SAVE_ERROR = "Le réglage n'a pas pu être enregistré";
const NETWORK_ERROR = "Connexion impossible. Réessayez.";

type ToggleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; enabled: boolean };

type SaveOutcome = { ok: true; enabled: boolean } | { ok: false; message: string };

/** `data.enabled` of an apiSuccess envelope, or null when the body is not that envelope. */
function readEnabled(body: unknown): boolean | null {
  if (typeof body !== "object" || body === null || !("data" in body)) return null;
  const { data } = body;
  if (typeof data !== "object" || data === null || !("enabled" in data)) return null;
  return typeof data.enabled === "boolean" ? data.enabled : null;
}

/** Parsed JSON body, or null when the answer is not JSON (an error page served by a proxy). */
async function jsonOrNull(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/** Saved state, or null when it could not be read (network, refusal, unexpected body). */
async function fetchSavedState(): Promise<boolean | null> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { cache: "no-store" });
  } catch {
    return null; // fetch ne rejette que sur coupure réseau
  }
  return res.ok ? readEnabled(await jsonOrNull(res)) : null;
}

async function saveState(enabled: boolean): Promise<SaveOutcome> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  } catch {
    return { ok: false, message: NETWORK_ERROR }; // fetch ne rejette que sur coupure réseau
  }
  const body = await jsonOrNull(res);
  const saved = res.ok ? readEnabled(body) : null;
  return saved === null
    ? { ok: false, message: refusalMessageOf(body) ?? SAVE_ERROR }
    : { ok: true, enabled: saved };
}

export function CommercialEmailsToggle(): JSX.Element {
  const [state, setState] = useState<ToggleState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const switchId = useId();
  const labelId = useId();
  const descriptionId = useId();

  useEffect(() => {
    let ignore = false;
    void fetchSavedState().then((enabled) => {
      if (!ignore) setState(enabled === null ? { status: "error" } : { status: "ready", enabled });
    });
    return () => {
      ignore = true;
    };
  }, [loadAttempt]);

  function retryLoad() {
    setState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }

  async function save(enabled: boolean) {
    setSaving(true);
    try {
      const outcome = await saveState(enabled);
      if (outcome.ok) {
        setState({ status: "ready", enabled: outcome.enabled });
        toast.success(
          outcome.enabled
            ? "Envoi des e-mails commerciaux activé"
            : "Envoi des e-mails commerciaux mis en pause"
        );
      } else {
        toast.error(outcome.message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Chargement du réglage…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {LOAD_ERROR}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={retryLoad}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="min-w-0">
        <label id={labelId} htmlFor={switchId} className="text-sm font-semibold text-foreground">
          Envoi des e-mails commerciaux
        </label>
        <p id={descriptionId} className="mt-0.5 text-xs text-muted-foreground">
          Campagnes, relances de panier abandonné et e-mails aux prospects. Les e-mails de commande
          (confirmation, commande prête, reçu) sont toujours envoyés.
        </p>
      </div>
      <div className="flex min-h-11 shrink-0 items-center gap-3">
        {saving && (
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
        )}
        <span
          className={
            state.enabled
              ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
          }
        >
          {state.enabled ? "Activé" : "En pause"}
        </span>
        <Switch
          id={switchId}
          checked={state.enabled}
          onCheckedChange={(enabled) => void save(enabled)}
          disabled={saving}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        />
      </div>
    </div>
  );
}
