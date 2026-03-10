"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mail,
  PartyPopper,
  RefreshCw,
  Gift,
  Smartphone,
  Bell,
  BarChart3,
  BookOpen,
  ShoppingBag,
  ChefHat,
  ArrowLeft,
  Sparkles,
  Upload,
  Palette,
  X,
  Wand2,
  FileText,
  Send,
  Copy,
  Users,
  Calendar,
  Check,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Predefined subject / body templates for "AI" generation
// ---------------------------------------------------------------------------

const CLIENT_SUBJECTS: Record<string, string[]> = {
  NEWSLETTER: [
    "Les nouveautés de la semaine chez Klik&Go",
    "Vos boucheries préférées vous attendent !",
    "Cette semaine : viandes d'exception en click & collect",
    "Le meilleur de la boucherie halal, livré en un clic",
  ],
  ONBOARDING: [
    "Bienvenue sur Klik&Go ! Voici comment commander",
    "Votre première commande vous attend",
    "Bienvenue ! Découvrez nos boucheries partenaires",
  ],
  REACTIVATION: [
    "Vous nous manquez ! Revenez découvrir nos nouveautés",
    "Ça fait un moment... une offre spéciale vous attend",
    "Vos boucheries favorites ont de nouvelles offres",
  ],
  PROMO: [
    "Offre exclusive : profitez-en avant qu'il ne soit trop tard",
    "Code promo spécial pour nos meilleurs clients",
    "Promotion flash : -20% sur votre prochaine commande",
  ],
};

const CLIENT_BODIES: Record<string, string[]> = {
  NEWSLETTER: [
    "Bonjour,\n\nDécouvrez cette semaine les dernières nouveautés de nos boucheries partenaires. Viandes fraîches, marinades maison et packs famille vous attendent en click & collect.\n\nCommandez maintenant et récupérez en boutique !",
    "Bonjour,\n\nNos artisans bouchers ont préparé des produits d'exception pour cette semaine. Côtes d'agneau, merguez artisanales et bien plus encore.\n\nPassez commande en quelques clics sur Klik&Go !",
  ],
  ONBOARDING: [
    "Bienvenue sur Klik&Go !\n\n1. Choisissez votre boucherie\n2. Composez votre panier\n3. Récupérez en boutique\n\nC'est aussi simple que ça. Profitez de la qualité artisanale sans attendre en caisse.",
  ],
  REACTIVATION: [
    "Bonjour,\n\nCela fait un moment que vous n'avez pas commandé. Nos boucheries partenaires ont plein de nouveautés à vous faire découvrir !\n\nRevenez vite, une surprise vous attend peut-être...",
  ],
  PROMO: [
    "Bonjour,\n\nProfitez d'une offre exceptionnelle réservée à nos clients fidèles. Utilisez le code promo ci-dessous lors de votre prochaine commande.\n\nOffre limitée dans le temps, ne tardez pas !",
  ],
};

const BUTCHER_SUBJECTS: Record<string, string[]> = {
  UPDATE: [
    "Nouvelles fonctionnalités disponibles sur votre espace",
    "Mise à jour Klik&Go : ce qui change pour vous",
  ],
  REMINDER: [
    "Rappel : commandes en attente à traiter",
    "N'oubliez pas de mettre à jour votre catalogue",
  ],
  REPORT: [
    "Votre rapport d'activité de la semaine",
    "Bilan mensuel : vos performances en un coup d'œil",
  ],
  EDUCATION: [
    "Astuce : comment booster vos ventes sur Klik&Go",
    "Guide : optimisez votre fiche boutique",
  ],
};

const BUTCHER_BODIES: Record<string, string[]> = {
  UPDATE: [
    "Bonjour,\n\nDe nouvelles fonctionnalités sont disponibles sur votre espace boucher. Découvrez les améliorations qui vont simplifier votre quotidien.\n\nConnectez-vous pour en profiter !",
  ],
  REMINDER: [
    "Bonjour,\n\nVous avez des commandes en attente de traitement. Pensez à les valider pour offrir la meilleure expérience à vos clients.\n\nAccédez à votre espace depuis l'application.",
  ],
  REPORT: [
    "Bonjour,\n\nVoici un résumé de votre activité cette semaine. Consultez vos statistiques détaillées dans votre tableau de bord pour optimiser vos performances.",
  ],
  EDUCATION: [
    "Bonjour,\n\nSaviez-vous que les boutiques avec des photos de qualité reçoivent 3x plus de commandes ?\n\nDécouvrez nos conseils pour améliorer votre visibilité et attirer plus de clients.",
  ],
};

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const VISUAL_COLORS = [
  { key: "red", bg: "bg-red-500", ring: "ring-red-300" },
  { key: "blue", bg: "bg-blue-500", ring: "ring-blue-300" },
  { key: "green", bg: "bg-emerald-500", ring: "ring-emerald-300" },
  { key: "purple", bg: "bg-purple-500", ring: "ring-purple-300" },
  { key: "amber", bg: "bg-amber-500", ring: "ring-amber-300" },
];

const PROMO_PRESETS = [
  { label: "-10%", type: "PERCENT", value: "10" },
  { label: "-15%", type: "PERCENT", value: "15" },
  { label: "-20%", type: "PERCENT", value: "20" },
  { label: "-3\u20AC", type: "AMOUNT", value: "3" },
  { label: "-5\u20AC", type: "AMOUNT", value: "5" },
  { label: "Frais offerts", type: "FREE_DELIVERY", value: "0" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  // --- State ---------------------------------------------------------------
  const [target, setTarget] = useState<"CLIENTS" | "BUTCHERS">("CLIENTS");
  const [type, setType] = useState("NEWSLETTER");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [visualTitle, setVisualTitle] = useState("");
  const [visualSubtitle, setVisualSubtitle] = useState("");
  const [visualColor, setVisualColor] = useState("red");
  const [visualImageUrl, setVisualImageUrl] = useState("");
  const [includePromo, setIncludePromo] = useState(false);
  const [promoMode, setPromoMode] = useState<"existing" | "create">("existing");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("PERCENT");
  const [newDiscountValue, setNewDiscountValue] = useState("10");
  const [newMinOrder, setNewMinOrder] = useState("0");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [audienceType, setAudienceType] = useState("CLIENTS_ALL");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [offers, setOffers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [audienceCounts, setAudienceCounts] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch on mount ------------------------------------------------------
  useEffect(() => {
    fetch("/api/dashboard/offers?status=ACTIVE")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setOffers(d.data);
      })
      .catch(() => {});

    fetch("/api/dashboard/marketing/audiences")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setAudienceCounts(d.data);
      })
      .catch(() => {});
  }, []);

  // --- Helpers -------------------------------------------------------------
  const isClients = target === "CLIENTS";

  const CLIENT_TYPES = [
    { key: "NEWSLETTER", label: "Newsletter", Icon: Mail },
    { key: "ONBOARDING", label: "Bienvenue", Icon: PartyPopper },
    { key: "REACTIVATION", label: "Relance", Icon: RefreshCw },
    { key: "PROMO", label: "Promo", Icon: Gift },
  ];

  const BUTCHER_TYPES = [
    { key: "UPDATE", label: "Mise \u00E0 jour", Icon: Smartphone },
    { key: "REMINDER", label: "Rappel", Icon: Bell },
    { key: "REPORT", label: "Rapport", Icon: BarChart3 },
    { key: "EDUCATION", label: "Formation", Icon: BookOpen },
  ];

  const typeOptions = isClients ? CLIENT_TYPES : BUTCHER_TYPES;

  function randomPick(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)] || "";
  }

  function generateSubject() {
    const pool = isClients
      ? CLIENT_SUBJECTS[type] || CLIENT_SUBJECTS.NEWSLETTER
      : BUTCHER_SUBJECTS[type] || BUTCHER_SUBJECTS.UPDATE;
    setSubject(randomPick(pool));
  }

  function generateBody() {
    const pool = isClients
      ? CLIENT_BODIES[type] || CLIENT_BODIES.NEWSLETTER
      : BUTCHER_BODIES[type] || BUTCHER_BODIES.UPDATE;
    setBody(randomPick(pool));
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "KG-";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewCode(code);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setVisualImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function applyTemplate() {
    setVisualTitle(subject || "Titre de la campagne");
    setVisualSubtitle(
      body ? body.slice(0, 80) + (body.length > 80 ? "..." : "") : "Sous-titre"
    );
  }

  // --- Selected offer detail -----------------------------------------------
  const selectedOffer = offers.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) => o.id === selectedOfferId
  );

  function formatOfferType(o: { type: string; discountValue: number }) {
    if (o.type === "PERCENT") return `-${o.discountValue}%`;
    if (o.type === "AMOUNT" || o.type === "FIXED") return `-${o.discountValue}\u20AC`;
    if (o.type === "FREE_DELIVERY") return "Frais offerts";
    if (o.type === "BOGO") return "1+1 offert";
    if (o.type === "BUNDLE") return "Pack";
    return o.type;
  }

  // --- Submit --------------------------------------------------------------
  async function handleSubmit(status: "DRAFT" | "SCHEDULED") {
    if (!subject.trim()) {
      toast.error("Veuillez saisir un objet");
      return;
    }
    setSaving(true);
    try {
      let offerId = selectedOfferId || null;

      // If creating new code, create offer first
      if (includePromo && promoMode === "create" && newCode) {
        const offerRes = await fetch("/api/dashboard/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Promo ${newCode}`,
            code: newCode,
            type: newType,
            discountValue: parseFloat(newDiscountValue) || 0,
            minOrder: parseFloat(newMinOrder) || 0,
            payer: "KLIKGO",
            audience: "ALL",
            startDate: new Date().toISOString(),
            endDate: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            maxUses: newMaxUses ? parseInt(newMaxUses) : null,
          }),
        });
        const offerJson = await offerRes.json();
        if (offerRes.ok) offerId = offerJson.data.id;
      }

      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subject,
          type,
          audience: audienceType,
          subject,
          body,
          visualTitle: visualTitle || null,
          visualSubtitle: visualSubtitle || null,
          visualColor,
          visualImageUrl: visualImageUrl || null,
          offerId,
          status,
          scheduledAt: scheduledAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Erreur");
        return;
      }

      // Actually send the campaign if scheduled
      if (status === "SCHEDULED") {
        await fetch(`/api/dashboard/campaigns/${json.data.id}/send`, {
          method: "POST",
        });
      }

      toast.success(
        status === "DRAFT"
          ? "Brouillon sauvegard\u00E9"
          : "Campagne envoy\u00E9e !"
      );
      onCreated();
    } catch {
      toast.error("Erreur r\u00E9seau");
    } finally {
      setSaving(false);
    }
  }

  // --- Promo display code for preview --------------------------------------
  const previewCode =
    includePromo && promoMode === "create" && newCode
      ? newCode
      : selectedOffer?.code || null;

  const previewMinOrder =
    includePromo && promoMode === "create"
      ? parseFloat(newMinOrder) || 0
      : selectedOffer?.minOrder || 0;

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:text-gray-400 dark:hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nouvelle campagne
        </h2>
      </div>

      {/* 2-column grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5 lg:col-span-3">
          {/* 1. Audience switch */}
          <div className="flex w-fit gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-[#141414]">
            <button
              type="button"
              onClick={() => {
                setTarget("CLIENTS");
                setType("NEWSLETTER");
                setAudienceType("CLIENTS_ALL");
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isClients
                  ? "bg-red-600 text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Clients
            </button>
            <button
              type="button"
              onClick={() => {
                setTarget("BUTCHERS");
                setType("UPDATE");
                setAudienceType("BUTCHERS_ALL");
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                !isClients
                  ? "bg-amber-500 text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <ChefHat className="h-4 w-4" />
              Bouchers
            </button>
          </div>

          {/* 2. Type selection */}
          <div className="grid grid-cols-4 gap-2">
            {typeOptions.map((t) => {
              const selected = type === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`rounded-xl border-2 p-3 text-center text-xs font-medium transition-colors ${
                    selected
                      ? isClients
                        ? "border-red-300 bg-red-50/50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400"
                        : "border-amber-300 bg-amber-50/50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-[#141414] dark:text-gray-400 dark:hover:border-white/20"
                  }`}
                >
                  <t.Icon className="mx-auto mb-1.5 h-5 w-5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 3. Subject */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-900 dark:text-white">
                Objet
              </label>
              <button
                type="button"
                onClick={generateSubject}
                className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                G\u00E9n\u00E9rer
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de votre email..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-red-500/40 dark:focus:ring-red-500/10"
            />
          </div>

          {/* 4. Content */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
              Contenu
            </label>
            <div className="relative">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="R\u00E9digez le contenu de votre email..."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-red-500/40 dark:focus:ring-red-500/10"
              />
              <button
                type="button"
                onClick={generateBody}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                R\u00E9diger IA
              </button>
            </div>
          </div>

          {/* 5. Visual header */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
            <label className="mb-3 block text-sm font-semibold text-gray-900 dark:text-white">
              Visuel d&apos;en-t\u00EAte{" "}
              <span className="font-normal text-gray-500 dark:text-gray-400">(optionnel)</span>
            </label>

            {/* Upload zone */}
            {!visualImageUrl ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-4 text-center dark:border-white/20">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Uploader
                  </button>
                  <button
                    type="button"
                    onClick={applyTemplate}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Template
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Image ou template color\u00E9
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative mb-3">
                <img
                  src={visualImageUrl}
                  alt="Visuel"
                  className="h-32 w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setVisualImageUrl("")}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Title / subtitle */}
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={visualTitle}
                onChange={(e) => setVisualTitle(e.target.value)}
                placeholder="Titre du visuel"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
              />
              <input
                type="text"
                value={visualSubtitle}
                onChange={(e) => setVisualSubtitle(e.target.value)}
                placeholder="Sous-titre du visuel"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>

            {/* Color circles */}
            <div className="mt-3 flex gap-2">
              {VISUAL_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setVisualColor(c.key)}
                  className={`h-7 w-7 rounded-full ${c.bg} transition-transform ${
                    visualColor === c.key
                      ? `scale-110 ring-2 ${c.ring} ring-offset-2 dark:ring-offset-[#141414]`
                      : "hover:scale-105"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 6. Code promo (clients only) */}
          {isClients && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includePromo}
                  onChange={(e) => setIncludePromo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500"
                />
                <Gift className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  Inclure un code promo
                </span>
              </label>

              {includePromo && (
                <div className="mt-4 space-y-4">
                  {/* Tabs */}
                  <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => setPromoMode("existing")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        promoMode === "existing"
                          ? "bg-white text-gray-900 shadow-sm dark:bg-[#1a1a1a] dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      Choisir existant
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoMode("create")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        promoMode === "create"
                          ? "bg-white text-gray-900 shadow-sm dark:bg-[#1a1a1a] dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      + Cr\u00E9er un code
                    </button>
                  </div>

                  {/* Existing offers */}
                  {promoMode === "existing" && (
                    <div className="space-y-3">
                      <select
                        value={selectedOfferId}
                        onChange={(e) => setSelectedOfferId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-red-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <option value="">S\u00E9lectionner une offre...</option>
                        {offers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.code})
                          </option>
                        ))}
                      </select>

                      {selectedOffer && (
                        <div className="rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/5">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                              {formatOfferType(selectedOffer)}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <Users className="h-3 w-3" />
                              {selectedOffer.audience}
                            </span>
                            {selectedOffer.minOrder > 0 && (
                              <span className="text-gray-500 dark:text-gray-400">
                                Min {selectedOffer.minOrder}\u20AC
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <Calendar className="h-3 w-3" />
                              {new Date(selectedOffer.startDate).toLocaleDateString("fr-FR")} -{" "}
                              {new Date(selectedOffer.endDate).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create new code */}
                  {promoMode === "create" && (
                    <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                      {/* Code input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCode}
                          onChange={(e) =>
                            setNewCode(e.target.value.toUpperCase())
                          }
                          placeholder="CODE-PROMO"
                          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white dark:placeholder:text-gray-500"
                        />
                        <button
                          type="button"
                          onClick={generateCode}
                          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-white/10"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Auto
                        </button>
                      </div>

                      {/* Type presets */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Type de r\u00E9duction
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {PROMO_PRESETS.map((p) => {
                            const selected =
                              newType === p.type &&
                              newDiscountValue === p.value;
                            return (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => {
                                  setNewType(p.type);
                                  setNewDiscountValue(p.value);
                                }}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                  selected
                                    ? "bg-red-600 text-white"
                                    : "bg-white text-gray-600 shadow-sm hover:bg-gray-50 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-white/10"
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Min order + Max uses */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            Min. commande (\u20AC)
                          </label>
                          <input
                            type="number"
                            value={newMinOrder}
                            onChange={(e) => setNewMinOrder(e.target.value)}
                            min="0"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-red-300 focus:outline-none dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            Max utilisations
                          </label>
                          <input
                            type="number"
                            value={newMaxUses}
                            onChange={(e) => setNewMaxUses(e.target.value)}
                            placeholder="Illimit\u00E9"
                            min="1"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white dark:placeholder:text-gray-500"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        L&apos;offre sera cr\u00E9\u00E9e automatiquement avec les m\u00EAmes
                        dates que la campagne (30 jours).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 7. Audience cible */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
            <label className="mb-3 block text-sm font-semibold text-gray-900 dark:text-white">
              Audience cible
            </label>
            <div className="grid grid-cols-2 gap-2">
              {isClients ? (
                <>
                  <AudienceRadio
                    value="CLIENTS_ALL"
                    label="Tous les clients"
                    count={audienceCounts?.total}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="red"
                  />
                  <AudienceRadio
                    value="CLIENTS_NEW"
                    label="Nouveaux < 2 cmd"
                    count={audienceCounts?.newClients}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="red"
                  />
                  <AudienceRadio
                    value="CLIENTS_LOYAL"
                    label="Fid\u00E8les 5+ cmd"
                    count={audienceCounts?.loyal}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="red"
                  />
                  <AudienceRadio
                    value="CLIENTS_INACTIVE"
                    label="Inactifs 30j+"
                    count={audienceCounts?.inactive}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="red"
                  />
                </>
              ) : (
                <>
                  <AudienceRadio
                    value="BUTCHERS_ALL"
                    label="Tous les bouchers"
                    count={audienceCounts?.butchersTotal}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="amber"
                  />
                  <AudienceRadio
                    value="BUTCHERS_NEW"
                    label="Nouveaux"
                    count={audienceCounts?.butchersNew}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="amber"
                  />
                  <AudienceRadio
                    value="BUTCHERS_ACTIVE"
                    label="Actifs"
                    count={audienceCounts?.butchersActive}
                    selected={audienceType}
                    onSelect={setAudienceType}
                    color="amber"
                  />
                </>
              )}
            </div>
          </div>

          {/* 8. Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit("DRAFT")}
              className="flex items-center gap-2 rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
            >
              <FileText className="h-4 w-4" />
              Brouillon
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit("SCHEDULED")}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {saving ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN — Email Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#141414]">
              {/* Preview header bar */}
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  isClients ? "bg-red-600" : "bg-amber-500"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <span className="text-sm font-bold text-white">K</span>
                </div>
                <span className="text-sm font-semibold text-white">
                  Klik&Go
                </span>
                <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
                  {isClients ? "Clients" : "Bouchers"}
                </span>
              </div>

              {/* Visual area */}
              {visualImageUrl ? (
                <img
                  src={visualImageUrl}
                  alt="Visual"
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20">
                  {visualTitle && (
                    <div className="px-4 text-center">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {visualTitle}
                      </p>
                      {visualSubtitle && (
                        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                          {visualSubtitle}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Body area */}
              <div className="space-y-3 px-4 py-4">
                {/* Subject */}
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {subject || "Objet de l\u2019email"}
                </h3>

                {/* Body preview or placeholder bars */}
                {body ? (
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">
                    {body}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-white/10" />
                    <div className="h-2.5 w-4/5 rounded-full bg-gray-100 dark:bg-white/10" />
                    <div className="h-2.5 w-3/5 rounded-full bg-gray-100 dark:bg-white/10" />
                  </div>
                )}

                {/* Promo code preview */}
                {includePromo && previewCode && (
                  <div className="rounded-xl bg-gray-50 p-4 text-center dark:bg-white/5">
                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                      Votre code promo
                    </p>
                    <p className="font-mono text-2xl font-bold text-red-600 dark:text-red-400">
                      {previewCode}
                    </p>
                    {(previewMinOrder > 0 || selectedOffer?.endDate) && (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {previewMinOrder > 0 && `Minimum ${previewMinOrder}\u20AC`}
                        {previewMinOrder > 0 && selectedOffer?.endDate && " \u00B7 "}
                        {selectedOffer?.endDate &&
                          `Valable jusqu\u2019au ${new Date(selectedOffer.endDate).toLocaleDateString("fr-FR")}`}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(previewCode);
                        toast.success("Code copi\u00E9 !");
                      }}
                      className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15"
                    >
                      <Copy className="h-3 w-3" />
                      Copier
                    </button>
                  </div>
                )}

                {/* CTA button */}
                <div
                  className={`rounded-xl py-2.5 text-center text-sm font-bold text-white ${
                    isClients ? "bg-red-600" : "bg-amber-500"
                  }`}
                >
                  {isClients ? "Commander maintenant" : "Acc\u00E9der \u00E0 mon espace"}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 p-3 text-center dark:border-white/10">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Klik&Go \u2014 Boucherie Halal Click &amp; Collect
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AudienceRadio sub-component
// ---------------------------------------------------------------------------

function AudienceRadio({
  value,
  label,
  count,
  selected,
  onSelect,
  color,
}: {
  value: string;
  label: string;
  count?: number;
  selected: string;
  onSelect: (val: string) => void;
  color: "red" | "amber";
}) {
  const isSelected = selected === value;
  const colorClasses =
    color === "red"
      ? {
          border: "border-red-300 dark:border-red-500/40",
          bg: "bg-red-50/30 dark:bg-red-500/5",
          check: "text-red-600 dark:text-red-400",
          ring: "border-red-400 dark:border-red-500",
        }
      : {
          border: "border-amber-300 dark:border-amber-500/40",
          bg: "bg-amber-50/30 dark:bg-amber-500/5",
          check: "text-amber-600 dark:text-amber-400",
          ring: "border-amber-400 dark:border-amber-500",
        };

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
        isSelected
          ? `${colorClasses.border} ${colorClasses.bg}`
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:hover:border-white/20"
      }`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          isSelected
            ? colorClasses.ring
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {isSelected && <Check className={`h-3 w-3 ${colorClasses.check}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </p>
        {count !== undefined && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {count} destinataire{count !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </button>
  );
}
