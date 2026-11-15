"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  Star,
  ExternalLink,
  Mail,
  MessageSquare,
  Loader2,
  Upload,
  X,
  Check,
  Globe,
} from "lucide-react";
import { refusalMessageOf } from "@/lib/api/client-refusal";

type ProspectStatus =
  | "NEW"
  | "CONTACTED"
  | "REPLIED"
  | "VISIT_SCHEDULED"
  | "VISITED"
  | "SIGNED"
  | "REFUSED"
  | "UNREACHABLE";

type Prospect = {
  id: string;
  name: string;
  city: string;
  zipCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  googleUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: ProspectStatus;
  source: "GOOGLE_PLACES" | "MANUAL" | "REFERRAL" | "INBOUND";
  notes: string | null;
  contactedAt: string | null;
  emailsSentCount: number;
  createdAt: string;
};

const STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  REPLIED: "A répondu",
  VISIT_SCHEDULED: "Visite prévue",
  VISITED: "Visité",
  SIGNED: "Signé ✅",
  REFUSED: "Refusé",
  UNREACHABLE: "Injoignable",
};

const STATUS_COLORS: Record<ProspectStatus, string> = {
  NEW: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  REPLIED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  VISIT_SCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  VISITED: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  SIGNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  REFUSED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  UNREACHABLE: "bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300",
};

export default function WebmasterProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");
  const [cityFilter, setCityFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showScrape, setShowScrape] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (search) params.set("search", search);
      params.set("limit", "200");

      const res = await fetch(`/api/webmaster/prospects?${params}`);
      const json = await res.json();
      if (json.success) {
        setProspects(json.data.prospects);
        setCounts(json.data.countsByStatus);
      }
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cityFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => prospects, [prospects]);

  async function updateStatus(id: string, status: ProspectStatus) {
    try {
      const res = await fetch(`/api/webmaster/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
        toast.success("Statut mis à jour");
        fetchData();
      } else toast.error("Erreur");
    } catch {
      toast.error("Erreur réseau");
    }
  }

  async function deleteProspect(id: string) {
    if (!confirm("Supprimer ce prospect ?")) return;
    try {
      const res = await fetch(`/api/webmaster/prospects/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProspects((prev) => prev.filter((p) => p.id !== id));
        toast.success("Supprimé");
      }
    } catch {
      toast.error("Erreur");
    }
  }

  async function sendEmail(id: string, template: "initial" | "relance_3j" | "relance_7j") {
    try {
      const res = await fetch(`/api/webmaster/prospects/${id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Email envoyé");
        fetchData();
      } else toast.error(json.error?.message || "Erreur d'envoi");
    } catch {
      toast.error("Erreur réseau");
    }
  }

  function whatsappLink(p: Prospect) {
    if (!p.phone) return null;
    const cleaned = p.phone.replace(/[^0-9+]/g, "").replace(/^0/, "+33");
    const text = encodeURIComponent(
      `Bonjour, je suis Tarik de Klik&Go. J'ai créé une plateforme gratuite click & collect pour les boucheries halal de ${p.city}. Pas d'abonnement, commission uniquement. 10 minutes pour vous montrer ? https://klikandgo.app/espace-boucher`
    );
    return `https://wa.me/${cleaned.replace(/^\+/, "")}?text=${text}`;
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold text-gray-900 dark:text-white">
            <Users size={20} /> Prospects
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Pipeline d&apos;acquisition de boucheries halal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScrape(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300 dark:hover:bg-white/5"
            title="Scraper Google Places"
          >
            <Globe size={13} /> Scraper Google Places
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300 dark:hover:bg-white/5"
          >
            <Upload size={13} /> Importer CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-3 py-2 text-xs font-bold text-white hover:bg-[#b91c1c]"
          >
            <Plus size={13} /> Ajouter
          </button>
        </div>
      </div>

      {/* KPI Pills par statut */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            statusFilter === "all"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
          }`}
        >
          Tous · {Object.values(counts).reduce((s, n) => s + n, 0)}
        </button>
        {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === st
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : `${STATUS_COLORS[st]} hover:opacity-80`
            }`}
          >
            {STATUS_LABELS[st]} · {counts[st] || 0}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, téléphone, email…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
          />
        </div>
        <input
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Ville…"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-[#DC2626]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center dark:border-white/10 dark:bg-[#141414]">
          <Users size={32} className="mx-auto mb-3 text-gray-400 dark:text-gray-600" />
          <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
            Aucun prospect pour ce filtre
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Lance le scraper Google Places ou ajoute manuellement
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-up rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.06] dark:bg-[#141414]"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[p.status]}`}
                    >
                      {STATUS_LABELS[p.status]}
                    </span>
                    {p.rating && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        <Star size={10} fill="currentColor" /> {p.rating} ({p.reviewCount || 0})
                      </span>
                    )}
                    {p.emailsSentCount > 0 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        📧 {p.emailsSentCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {p.city}
                      {p.zipCode && ` ${p.zipCode}`}
                    </span>
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        <Phone size={11} /> {p.phone}
                      </a>
                    )}
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        <Mail size={11} /> {p.email}
                      </a>
                    )}
                    {p.googleUrl && (
                      <a
                        href={p.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-[#DC2626]"
                      >
                        <ExternalLink size={11} /> Google
                      </a>
                    )}
                  </div>
                  {p.notes && (
                    <p className="mt-2 text-[11px] italic text-gray-600 dark:text-gray-400">
                      {p.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.phone && whatsappLink(p) && (
                    <a
                      href={whatsappLink(p)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                      title="Envoyer WhatsApp"
                    >
                      <MessageSquare size={11} /> WA
                    </a>
                  )}
                  {p.email && (
                    <button
                      onClick={() =>
                        sendEmail(
                          p.id,
                          p.emailsSentCount === 0
                            ? "initial"
                            : p.emailsSentCount === 1
                              ? "relance_3j"
                              : "relance_7j"
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-600"
                      title="Envoyer email"
                    >
                      <Mail size={11} /> Email
                    </button>
                  )}
                  <select
                    value={p.status}
                    onChange={(e) => updateStatus(p.id, e.target.value as ProspectStatus)}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
                  >
                    {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteProspect(p.id)}
                    className="rounded-lg px-2 py-1.5 text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Supprimer"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            fetchData();
          }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            fetchData();
          }}
        />
      )}
      {showScrape && (
        <ScrapeModal
          onClose={() => setShowScrape(false)}
          onDone={() => {
            setShowScrape(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Add prospect modal
// ──────────────────────────────────────────
function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/webmaster/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          phone: phone || undefined,
          email: email || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Prospect ajouté");
        onCreated();
      } else toast.error(json.error?.message || "Erreur");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#141414]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouveau prospect</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la boucherie *"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0a0a0a]"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ville *"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0a0a0a]"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0a0a0a]"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0a0a0a]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optionnel)"
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0a0a0a]"
          />
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 dark:bg-white/5 dark:text-gray-300"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!name || !city || saving}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Import CSV modal
// ──────────────────────────────────────────
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/webmaster/prospects/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        toast.success(`${json.data.inserted} créés, ${json.data.updated} mis à jour`);
      } else toast.error(json.error?.message || "Erreur");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 dark:bg-[#141414]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Importer CSV de prospects
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Format attendu (1ère ligne = headers) :{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-white/5">
            name,address,city,zipCode,phone,googleUrl,rating,reviewCount,googlePlaceId
          </code>
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`name,city,phone,email\n"Boucherie El Hadj","Lyon","+33478...",contact@..\n...`}
          rows={12}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs dark:border-white/10 dark:bg-[#0a0a0a]"
        />
        {result && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            ✅ {result.inserted} créés · 🔄 {result.updated} mis à jour · ⏭️ {result.skipped} skip
            {result.errors.length > 0 && (
              <p className="mt-1 text-amber-700 dark:text-amber-400">
                ⚠️ {result.errors.length} erreurs
              </p>
            )}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 dark:bg-white/5 dark:text-gray-300"
          >
            {result ? "Fermer" : "Annuler"}
          </button>
          {!result && (
            <button
              onClick={submit}
              disabled={!csv.trim() || saving}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importer
            </button>
          )}
          {result && (
            <button
              onClick={onDone}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Check size={14} /> Voir les prospects
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scrape Google Places Modal ──────────────────────
function ScrapeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(15);
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<{
    scraped: number;
    upserted: number;
    sample?: { name: string; address: string }[];
  } | null>(null);

  async function submit() {
    if (!city.trim()) return;
    setScraping(true);
    try {
      const res = await fetch("/api/admin/scrape-butchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city.trim(), radiusKm: radius }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = refusalMessageOf(data) ?? "Erreur scraping";
        const hint = data?.hint ? `\n\n💡 ${data.hint}` : "";
        toast.error(`${err}${hint}`);
        setScraping(false);
        return;
      }
      setResult({ scraped: data.scraped, upserted: data.upserted, sample: data.sample });
      toast.success(
        `${data.upserted} boucherie${data.upserted > 1 ? "s" : ""} ajoutée${data.upserted > 1 ? "s" : ""}/MAJ pour ${city}`
      );
    } catch (err) {
      toast.error(`Erreur réseau : ${String(err)}`);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#141414]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Globe size={16} /> Scraper Google Places
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Cherche les boucheries halal d&apos;une ville via Google Places et les ajoute en
              prospects. Nécessite la variable d&apos;environnement{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-white/10">
                GOOGLE_PLACES_API_KEY
              </code>{" "}
              côté Vercel.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Ville
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lyon, Grenoble, Chambéry…"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Rayon de recherche : {radius} km
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>5 km</span>
                  <span>15 km</span>
                  <span>50 km</span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 dark:bg-white/5 dark:text-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={!city.trim() || scraping}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {scraping ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                {scraping ? "Scraping…" : "Lancer"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="mb-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                ✅ {result.upserted} prospect{result.upserted > 1 ? "s" : ""} ajouté
                {result.upserted > 1 ? "s" : ""}/MAJ
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                {result.scraped} boucheries trouvées par Google Places
              </p>
            </div>
            {result.sample && result.sample.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Exemples :</p>
                {result.sample.map((s, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/5">
                    <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.address}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onDone}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Check size={14} /> Voir les prospects
            </button>
          </>
        )}
      </div>
    </div>
  );
}
