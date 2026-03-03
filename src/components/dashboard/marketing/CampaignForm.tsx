"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  PartyPopper,
  RefreshCw,
  Gift,
  Smartphone,
  Bell,
  BarChart3,
  BookOpen,
  X,
  Loader2,
  Sparkles,
  Palette,
  Upload,
  FileText,
  Calendar,
  Send,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AudienceMode = "clients" | "bouchers";

type CampaignType =
  | "NEWSLETTER"
  | "ONBOARDING"
  | "REACTIVATION"
  | "PROMO"
  | "UPDATE"
  | "REMINDER"
  | "REPORT"
  | "EDUCATION";

type CampaignAudience =
  | "CLIENTS_ALL"
  | "CLIENTS_NEW"
  | "CLIENTS_LOYAL"
  | "CLIENTS_INACTIVE"
  | "BUTCHERS_ALL"
  | "BUTCHERS_NEW"
  | "BUTCHERS_ACTIVE";

type ActiveOffer = {
  id: string;
  code: string;
  name: string;
  type: string;
};

interface CampaignFormProps {
  onClose: () => void;
  onCreated: () => void;
  defaultAudience?: "clients" | "bouchers";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TypeOption = {
  key: CampaignType;
  icon: typeof Mail;
  label: string;
  desc: string;
};

const CLIENT_TYPES: TypeOption[] = [
  { key: "NEWSLETTER", icon: Mail, label: "Newsletter", desc: "Actualites et nouveautes" },
  { key: "ONBOARDING", icon: PartyPopper, label: "Bienvenue", desc: "Nouveaux inscrits" },
  { key: "REACTIVATION", icon: RefreshCw, label: "Relance", desc: "Clients inactifs" },
  { key: "PROMO", icon: Gift, label: "Promo", desc: "Offres exclusives" },
];

const BUTCHER_TYPES: TypeOption[] = [
  { key: "UPDATE", icon: Smartphone, label: "Mise a jour", desc: "Evolutions plateforme" },
  { key: "REMINDER", icon: Bell, label: "Rappel", desc: "Actions a faire" },
  { key: "REPORT", icon: BarChart3, label: "Rapport", desc: "Stats et performances" },
  { key: "EDUCATION", icon: BookOpen, label: "Formation", desc: "Conseils et astuces" },
];

type AudienceOption = {
  key: CampaignAudience;
  label: string;
};

const CLIENT_AUDIENCES: AudienceOption[] = [
  { key: "CLIENTS_ALL", label: "Tous les clients" },
  { key: "CLIENTS_NEW", label: "Nouveaux" },
  { key: "CLIENTS_LOYAL", label: "Fideles 3+" },
  { key: "CLIENTS_INACTIVE", label: "Inactifs 30j+" },
];

const BUTCHER_AUDIENCES: AudienceOption[] = [
  { key: "BUTCHERS_ALL", label: "Tous" },
  { key: "BUTCHERS_NEW", label: "Nouveaux" },
  { key: "BUTCHERS_ACTIVE", label: "Actifs" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function audienceLabel(audience: CampaignAudience): string {
  const all = [...CLIENT_AUDIENCES, ...BUTCHER_AUDIENCES];
  return all.find((a) => a.key === audience)?.label ?? audience;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignForm({
  onClose,
  onCreated,
  defaultAudience,
}: CampaignFormProps) {
  // ---- State ----------------------------------------------------------------

  const [audienceMode, setAudienceMode] = useState<AudienceMode>(
    defaultAudience ?? "clients"
  );
  const [type, setType] = useState<CampaignType>(
    defaultAudience === "bouchers" ? "UPDATE" : "NEWSLETTER"
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [visualImageUrl, setVisualImageUrl] = useState<string | null>(null);
  const [audience, setAudience] = useState<CampaignAudience>(
    defaultAudience === "bouchers" ? "BUTCHERS_ALL" : "CLIENTS_ALL"
  );

  // Promo attachment
  const [attachOffer, setAttachOffer] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // AI
  const [generatingSubject, setGeneratingSubject] = useState(false);
  const [generatingBody, setGeneratingBody] = useState(false);

  // UI
  const [submitting, setSubmitting] = useState(false);

  const isClient = audienceMode === "clients";
  const types = isClient ? CLIENT_TYPES : BUTCHER_TYPES;
  const audiences = isClient ? CLIENT_AUDIENCES : BUTCHER_AUDIENCES;
  const selectedOffer = activeOffers.find((o) => o.id === selectedOfferId);

  // ---- Audience mode switch -------------------------------------------------

  const switchAudience = useCallback(
    (mode: AudienceMode) => {
      setAudienceMode(mode);
      if (mode === "clients") {
        setType("NEWSLETTER");
        setAudience("CLIENTS_ALL");
      } else {
        setType("UPDATE");
        setAudience("BUTCHERS_ALL");
      }
      setAttachOffer(false);
      setSelectedOfferId("");
    },
    []
  );

  // ---- Fetch active offers (for attach) -------------------------------------

  useEffect(() => {
    if (!attachOffer || !isClient) return;
    async function fetchOffers() {
      setLoadingOffers(true);
      try {
        const res = await fetch("/api/dashboard/offers?status=ACTIVE");
        const json = await res.json();
        if (json.success) {
          setActiveOffers(json.data ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoadingOffers(false);
      }
    }
    fetchOffers();
  }, [attachOffer, isClient]);

  // ---- AI generation --------------------------------------------------------

  const generateSubject = useCallback(async () => {
    setGeneratingSubject(true);
    try {
      const typeInfo = types.find((t) => t.key === type);
      const SUBJECTS: Record<string, string[]> = {
        NEWSLETTER: ["Nouveautes chez Klik&Go", "Vos boucheries preferees vous attendent", "Decouvrez nos nouvelles boutiques", "Les tendances viande du moment"],
        ONBOARDING: ["Bienvenue sur Klik&Go !", "Votre boucherie halal en 1 clic", "Pret a commander ? C'est parti !", "Decouvrez Klik&Go en 3 etapes"],
        REACTIVATION: ["Vous nous manquez !", "Une offre speciale vous attend", "Revenez decouvrir nos nouveautes", "Ca fait longtemps ! -10% pour vous"],
        PROMO: ["Offre exclusive Klik&Go", "Promo flash : ne ratez pas ca", "Vos produits halal en promo", "Code promo special pour vous"],
        UPDATE: ["Nouveautes plateforme Klik&Go", "Mise a jour importante", "De nouvelles fonctionnalites arrivent", "Klik&Go evolue pour vous"],
        REMINDER: ["Rappel : actions en attente", "N'oubliez pas vos commandes", "Un point important a verifier", "Rappel de la semaine"],
        REPORT: ["Votre rapport mensuel", "Vos stats du mois", "Performance de votre boutique", "Bilan et tendances"],
        EDUCATION: ["Conseil : optimisez vos ventes", "Astuce pour plus de clients", "Guide : mieux utiliser Klik&Go", "Formation express"],
      };
      const pool = SUBJECTS[type] ?? SUBJECTS.NEWSLETTER;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setSubject(picked ?? `${typeInfo?.label ?? type} — Klik&Go`);
    } catch {
      toast.error("Erreur generation");
    } finally {
      setGeneratingSubject(false);
    }
  }, [type, types]);

  const generateBody = useCallback(async () => {
    setGeneratingBody(true);
    try {
      const BODIES: Record<string, string[]> = {
        NEWSLETTER: [
          "Bonjour ! Decouvrez les dernieres nouveautes de nos boucheries partenaires. De nouveaux produits halal de qualite vous attendent sur Klik&Go. Commandez en ligne et retirez en boutique en toute simplicite.",
          "Chers clients, cette semaine nos bouchers vous ont prepare une selection exceptionnelle. Viandes fraiches, marinades maison et specialites du moment. Passez commande maintenant !",
        ],
        ONBOARDING: [
          "Bienvenue sur Klik&Go ! Nous sommes ravis de vous compter parmi nous. Decouvrez nos boucheries halal artisanales pres de chez vous et passez votre premiere commande en quelques clics.",
          "Felicitations pour votre inscription ! Sur Klik&Go, commandez vos viandes halal preferees et retirez-les en boutique. Simple, rapide et toujours frais.",
        ],
        REACTIVATION: [
          "Cela fait un moment que vous n'etes pas venu nous voir ! Vos boucheries preferees ont de nouvelles specialites a vous faire decouvrir. Profitez-en, une surprise vous attend.",
          "Vous nous manquez ! Nos bouchers ont prepare de nouvelles recettes et produits. Revenez decouvrir tout ca avec un avantage exclusif.",
        ],
        PROMO: [
          "Bonne nouvelle ! Une offre speciale vous attend sur Klik&Go. Profitez de reductions exclusives sur vos viandes halal preferees. Offre limitee, ne tardez pas !",
          "Offre flash ! Vos produits halal a prix reduit pendant une duree limitee. Commandez maintenant sur Klik&Go et economisez sur votre prochain panier.",
        ],
        UPDATE: [
          "Chers bouchers partenaires, nous avons ameliore la plateforme pour vous faciliter la gestion de vos commandes. Decouvrez les nouvelles fonctionnalites disponibles des maintenant.",
          "Mise a jour Klik&Go ! De nouvelles options sont disponibles pour optimiser votre boutique en ligne. Connectez-vous pour les decouvrir.",
        ],
        REMINDER: [
          "Un petit rappel : vous avez des actions en attente sur votre espace Klik&Go. Prenez quelques minutes pour mettre a jour votre catalogue et repondre aux commandes.",
          "N'oubliez pas de verifier vos commandes en cours et de mettre a jour vos horaires si necessaire. Vos clients comptent sur vous !",
        ],
        REPORT: [
          "Voici votre rapport de performance du mois. Decouvrez vos chiffres cles, vos produits les plus vendus et les tendances de votre clientele. Analysez et optimisez !",
          "Bilan mensuel disponible ! Consultez vos statistiques de vente, le nombre de commandes et votre taux de satisfaction client.",
        ],
        EDUCATION: [
          "Astuce du jour : saviez-vous que les boutiques avec des photos de qualite ont 40% de commandes en plus ? Mettez a jour vos visuels pour attirer plus de clients.",
          "Conseil pro : activez les notifications push pour ne manquer aucune commande. Vos clients apprecient la reactivite !",
        ],
      };
      const pool = BODIES[type] ?? BODIES.NEWSLETTER;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setBody(picked ?? "");
    } catch {
      toast.error("Erreur generation");
    } finally {
      setGeneratingBody(false);
    }
  }, [type]);

  // ---- Submit ---------------------------------------------------------------

  const handleSubmit = useCallback(
    async (action: "draft" | "schedule" | "send") => {
      if (!subject.trim()) {
        toast.error("Veuillez saisir un objet");
        return;
      }
      if (!body.trim()) {
        toast.error("Veuillez saisir le contenu");
        return;
      }

      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          title: subject.trim(),
          type,
          audience,
          subject: subject.trim(),
          body: body.trim(),
          status:
            action === "draft"
              ? "DRAFT"
              : action === "schedule"
              ? "SCHEDULED"
              : "SENDING",
          ...(visualImageUrl && { visualImageUrl }),
          ...(attachOffer &&
            selectedOfferId && { offerId: selectedOfferId }),
        };

        const res = await fetch("/api/dashboard/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();

        if (json.success) {
          const labels = {
            draft: "Brouillon sauvegarde",
            schedule: "Campagne programmee",
            send: "Campagne envoyee",
          };
          toast.success(labels[action]);
          onCreated();
        } else {
          toast.error(json.error ?? "Erreur lors de la creation");
        }
      } catch {
        toast.error("Erreur reseau");
      } finally {
        setSubmitting(false);
      }
    },
    [
      subject,
      body,
      type,
      audience,
      visualImageUrl,
      attachOffer,
      selectedOfferId,
      onCreated,
    ]
  );

  // ---- Render ---------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#141414] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Nouvelle campagne
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* ---- Audience mode toggle ---- */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 p-1 flex gap-1 w-fit">
          <button
            onClick={() => switchAudience("clients")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-lg ${
              isClient
                ? "bg-red-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <Mail className="h-4 w-4" />
            Clients
          </button>
          <button
            onClick={() => switchAudience("bouchers")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-lg ${
              !isClient
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <Bell className="h-4 w-4" />
            Bouchers
          </button>
        </div>

        {/* ---- 2-Column Layout ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ========== LEFT COLUMN — Formulaire ========== */}
          <div className="col-span-1 lg:col-span-3 space-y-4">
            {/* 1. Type selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Type de campagne
              </label>
              <div className="grid grid-cols-2 gap-2">
                {types.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setType(t.key)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                        type === t.key
                          ? "border-red-300 bg-red-50/50 dark:bg-red-500/10 border-2"
                          : "border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${
                          type === t.key
                            ? isClient
                              ? "bg-red-100 dark:bg-red-500/20"
                              : "bg-amber-100 dark:bg-amber-500/20"
                            : "bg-gray-100 dark:bg-white/10"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            type === t.key
                              ? isClient
                                ? "text-red-600"
                                : "text-amber-500"
                              : "text-gray-500"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t.label}
                        </div>
                        <div className="text-xs text-gray-500">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Objet
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Objet de l'email..."
                  className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
                <button
                  onClick={generateSubject}
                  disabled={generatingSubject}
                  className="bg-purple-50 text-purple-600 rounded-lg px-2 py-1.5 hover:bg-purple-100 transition disabled:opacity-50"
                  title="Generer avec l'IA"
                >
                  {generatingSubject ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 3. Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Contenu
              </label>
              <div className="relative">
                <textarea
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Redigez votre message..."
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                />
                <button
                  onClick={generateBody}
                  disabled={generatingBody}
                  className="absolute bottom-2 right-2 bg-purple-50 text-purple-600 rounded-lg px-2 py-1 text-xs font-medium hover:bg-purple-100 transition disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {generatingBody ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Rediger IA
                </button>
              </div>
            </div>

            {/* 4. Visual header */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Visuel (optionnel)
              </label>
              <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-4 flex items-center justify-center gap-3">
                {visualImageUrl ? (
                  <div className="relative w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visualImageUrl} alt="Visuel" className="w-full h-24 object-cover rounded-lg" />
                    <button
                      onClick={() => setVisualImageUrl(null)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      Uploader
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setVisualImageUrl(url);
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setVisualImageUrl("/img/marketing-placeholder.jpg")}
                      className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      Template
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 5. Attach promo code (clients only) */}
            {isClient && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachOffer}
                    onChange={(e) => {
                      setAttachOffer(e.target.checked);
                      if (!e.target.checked) setSelectedOfferId("");
                    }}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  <Gift className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Attacher un code promo
                  </span>
                </label>

                {attachOffer && (
                  <div className="ml-6">
                    {loadingOffers ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        <span className="text-xs text-gray-500">
                          Chargement...
                        </span>
                      </div>
                    ) : activeOffers.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">
                        Aucune offre active disponible
                      </p>
                    ) : (
                      <select
                        value={selectedOfferId}
                        onChange={(e) => setSelectedOfferId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                      >
                        <option value="">Selectionner une offre...</option>
                        {activeOffers.map((offer) => (
                          <option key={offer.id} value={offer.id}>
                            {offer.name} ({offer.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 6. Audience target */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Audience cible
              </label>
              <div className="grid grid-cols-2 gap-2">
                {audiences.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAudience(a.key)}
                    className={`rounded-xl border p-3 text-sm font-medium text-center transition ${
                      audience === a.key
                        ? isClient
                          ? "border-red-300 bg-red-50/50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-2"
                          : "border-amber-300 bg-amber-50/50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-2"
                        : "border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 7. Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleSubmit("draft")}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-gray-300 dark:hover:bg-white/20 transition disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Brouillon
              </button>
              <button
                onClick={() => handleSubmit("schedule")}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Programmer
              </button>
              <button
                onClick={() => handleSubmit("send")}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-red-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-red-700 transition disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer
              </button>
            </div>
          </div>

          {/* ========== RIGHT COLUMN — Preview ========== */}
          <div className="col-span-1 lg:col-span-2 lg:sticky lg:top-6 self-start">
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Apercu email
              </div>

              {/* Email preview */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                {/* Header */}
                <div
                  className={`h-14 flex items-center px-4 gap-3 ${
                    isClient ? "bg-red-600" : "bg-amber-500"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">K</span>
                  </div>
                  <span className="text-white font-semibold text-sm flex-1">
                    Klik&amp;Go
                  </span>
                  <span className="bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {audienceLabel(audience)}
                  </span>
                </div>

                {/* Visual zone */}
                {visualImageUrl ? (
                  <div className="h-28 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visualImageUrl}
                      alt="Visuel campagne"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-800/20 h-28 flex flex-col items-center justify-center gap-1">
                    <Palette className="h-6 w-6 text-red-300 dark:text-red-700" />
                    <span className="text-xs text-red-300 dark:text-red-700">
                      Visuel ici
                    </span>
                  </div>
                )}

                {/* Body */}
                <div className="p-5 space-y-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {subject || "Objet de l'email"}
                  </h2>

                  {body ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                      {body}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 dark:bg-white/10 rounded w-full" />
                      <div className="h-3 bg-gray-100 dark:bg-white/10 rounded w-4/5" />
                      <div className="h-3 bg-gray-100 dark:bg-white/10 rounded w-3/5" />
                    </div>
                  )}

                  {/* Attached offer */}
                  {attachOffer && selectedOffer && (
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center space-y-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Votre code promo
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-mono font-bold text-red-600">
                          {selectedOffer.code}
                        </span>
                        <Copy className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedOffer.name}
                      </div>
                    </div>
                  )}

                  {/* CTA button */}
                  <button
                    disabled
                    className={`w-full rounded-xl py-3 text-white font-bold text-sm opacity-90 ${
                      isClient ? "bg-red-600" : "bg-amber-500"
                    }`}
                  >
                    {isClient ? "Decouvrir" : "Voir les details"}
                  </button>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-white/5 p-3 text-center">
                  <span className="text-xs text-gray-400">
                    Klik&amp;Go &mdash; Boucherie Halal Click &amp; Collect
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
