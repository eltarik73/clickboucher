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
        setProspects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status } : p))
        );
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
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={20} /> Prospects
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Pipeline d&apos;acquisition de boucheries halal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScrape(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
            title="Scraper Google Places"
          >
            <Globe size={13} /> Scraper Google Places
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <Upload size={13} /> Importer CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#DC2626] text-white rounded-xl hover:bg-[#b91c1c]"
          >
            <Plus size={13} /> Ajouter
          </button>
        </div>
      </div>

      {/* KPI Pills par statut */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
            statusFilter === "all"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
          }`}
        >
          Tous · {Object.values(counts).reduce((s, n) => s + n, 0)}
        </button>
        {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
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
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, téléphone, email…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300"
          />
        </div>
        <input
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Ville…"
          className="px-3 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-[#DC2626]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10">
          <Users size={32} className="mx-auto text-gray-400 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
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
              className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    {p.rating && (
                      <span className="text-[10px] inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        <Star size={10} fill="currentColor" /> {p.rating} ({p.reviewCount || 0})
                      </span>
                    )}
                    {p.emailsSentCount > 0 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        📧 {p.emailsSentCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
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
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 italic">{p.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {p.phone && whatsappLink(p) && (
                    <a
                      href={whatsappLink(p)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
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
                          p.emailsSentCount === 0 ? "initial" : p.emailsSentCount === 1 ? "relance_3j" : "relance_7j"
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      title="Envoyer email"
                    >
                      <Mail size={11} /> Email
                    </button>
                  )}
                  <select
                    value={p.status}
                    onChange={(e) => updateStatus(p.id, e.target.value as ProspectStatus)}
                    className="px-2 py-1.5 text-[10px] font-semibold bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteProspect(p.id)}
                    className="px-2 py-1.5 text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
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
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchData(); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); fetchData(); }} />}
      {showScrape && <ScrapeModal onClose={() => setShowScrape(false)} onDone={() => { setShowScrape(false); fetchData(); }} />}
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
        body: JSON.stringify({ name, city, phone: phone || undefined, email: email || undefined, notes: notes || undefined }),
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouveau prospect</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la boucherie *" className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville *" className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)" rows={3} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl resize-none" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl">Annuler</button>
          <button onClick={submit} disabled={!name || !city || saving} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-[#DC2626] text-white rounded-xl disabled:opacity-50">
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
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; errors: string[] } | null>(null);

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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Importer CSV de prospects</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Format attendu (1ère ligne = headers) : <code className="bg-gray-100 dark:bg-white/5 px-1 rounded">name,address,city,zipCode,phone,googleUrl,rating,reviewCount,googlePlaceId</code>
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`name,city,phone,email\n"Boucherie El Hadj","Lyon","+33478...",contact@..\n...`}
          rows={12}
          className="w-full px-3 py-2 text-xs font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl resize-none"
        />
        {result && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
            ✅ {result.inserted} créés · 🔄 {result.updated} mis à jour · ⏭️ {result.skipped} skip
            {result.errors.length > 0 && <p className="mt-1 text-amber-700 dark:text-amber-400">⚠️ {result.errors.length} erreurs</p>}
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl">
            {result ? "Fermer" : "Annuler"}
          </button>
          {!result && (
            <button onClick={submit} disabled={!csv.trim() || saving} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-[#DC2626] text-white rounded-xl disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importer
            </button>
          )}
          {result && (
            <button onClick={onDone} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl">
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
  const [result, setResult] = useState<{ scraped: number; upserted: number; sample?: { name: string; address: string }[] } | null>(null);

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
        const err = data?.error || "Erreur scraping";
        const hint = data?.hint ? `\n\n💡 ${data.hint}` : "";
        toast.error(`${err}${hint}`);
        setScraping(false);
        return;
      }
      setResult({ scraped: data.scraped, upserted: data.upserted, sample: data.sample });
      toast.success(`${data.upserted} boucherie${data.upserted > 1 ? "s" : ""} ajoutée${data.upserted > 1 ? "s" : ""}/MAJ pour ${city}`);
    } catch (err) {
      toast.error(`Erreur réseau : ${String(err)}`);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white inline-flex items-center gap-2">
            <Globe size={16} /> Scraper Google Places
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Cherche les boucheries halal d&apos;une ville via Google Places et les ajoute en prospects.
              Nécessite la variable d&apos;environnement <code className="bg-gray-100 dark:bg-white/10 px-1 rounded">GOOGLE_PLACES_API_KEY</code> côté Vercel.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Ville
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lyon, Grenoble, Chambéry…"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
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
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>5 km</span>
                  <span>15 km</span>
                  <span>50 km</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl">
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={!city.trim() || scraping}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-[#DC2626] text-white rounded-xl disabled:opacity-50"
              >
                {scraping ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                {scraping ? "Scraping…" : "Lancer"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                ✅ {result.upserted} prospect{result.upserted > 1 ? "s" : ""} ajouté{result.upserted > 1 ? "s" : ""}/MAJ
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                {result.scraped} boucheries trouvées par Google Places
              </p>
            </div>
            {result.sample && result.sample.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Exemples :</p>
                {result.sample.map((s, i) => (
                  <div key={i} className="text-xs bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">{s.address}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onDone} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl">
              <Check size={14} /> Voir les prospects
            </button>
          </>
        )}
      </div>
    </div>
  );
}
