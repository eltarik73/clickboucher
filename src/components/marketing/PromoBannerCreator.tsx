// src/components/marketing/PromoBannerCreator.tsx — Promo Banner Creator (template-based)
"use client";

import { useState, useRef, useCallback } from "react";
import {
  Download,
  Type,
  Palette,
  Maximize,
  Sparkles,
  RotateCcw,
  Check,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

// ── Templates ──
type Template = {
  id: string;
  name: string;
  bg: string; // CSS background
  textColor: string;
  badgeColor: string;
  badgeText: string;
  overlay?: string;
};

const TEMPLATES: Template[] = [
  {
    id: "red-gradient",
    name: "Rouge Intense",
    bg: "linear-gradient(135deg, #DC2626 0%, #991B1B 50%, #7F1D1D 100%)",
    textColor: "white",
    badgeColor: "#FEF08A",
    badgeText: "#7F1D1D",
  },
  {
    id: "dark-luxury",
    name: "Noir Luxe",
    bg: "linear-gradient(135deg, #0A0A0A 0%, #1C1917 50%, #292524 100%)",
    textColor: "white",
    badgeColor: "#DC2626",
    badgeText: "white",
  },
  {
    id: "gold-premium",
    name: "Or Premium",
    bg: "linear-gradient(135deg, #78350F 0%, #92400E 40%, #B45309 100%)",
    textColor: "white",
    badgeColor: "#FEF3C7",
    badgeText: "#78350F",
  },
  {
    id: "fresh-green",
    name: "Vert Frais",
    bg: "linear-gradient(135deg, #065F46 0%, #047857 50%, #059669 100%)",
    textColor: "white",
    badgeColor: "#D1FAE5",
    badgeText: "#065F46",
  },
  {
    id: "warm-sunset",
    name: "Coucher Chaud",
    bg: "linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #D97706 100%)",
    textColor: "white",
    badgeColor: "white",
    badgeText: "#DC2626",
  },
  {
    id: "royal-blue",
    name: "Bleu Royal",
    bg: "linear-gradient(135deg, #1E3A5F 0%, #1E40AF 50%, #3B82F6 100%)",
    textColor: "white",
    badgeColor: "#DBEAFE",
    badgeText: "#1E3A5F",
  },
];

// ── Sizes ──
type SizePreset = { id: string; name: string; width: number; height: number };

const SIZE_PRESETS: SizePreset[] = [
  { id: "post", name: "Post (1:1)", width: 1080, height: 1080 },
  { id: "banner", name: "Bannière (2:1)", width: 1200, height: 600 },
  { id: "story", name: "Story (9:16)", width: 1080, height: 1920 },
  { id: "web", name: "Web (3:1)", width: 1440, height: 480 },
];

// ── Promo presets ──
type PromoPreset = { headline: string; subtitle: string; badge: string };

const PROMO_PRESETS: PromoPreset[] = [
  { headline: "Frais de commande offerts", subtitle: "Sur votre 1ère commande", badge: "OFFERT" },
  { headline: "-20% sur tout le magasin", subtitle: "Offre limitée ce week-end", badge: "-20%" },
  { headline: "1 acheté = 1 offert", subtitle: "Sur les merguez artisanales", badge: "2 POUR 1" },
  { headline: "Livraison gratuite", subtitle: "Dès 30€ d'achat", badge: "GRATUIT" },
  { headline: "Pack Barbecue", subtitle: "Tout pour un BBQ réussi à prix mini", badge: "-15%" },
  { headline: "Offre Ramadan", subtitle: "Sélection spéciale viandes et brochettes", badge: "PROMO" },
];

type Props = {
  onCreated?: (dataUrl: string) => void;
};

export default function PromoBannerCreator({ onCreated }: Props) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [headline, setHeadline] = useState("Frais de commande offerts");
  const [subtitle, setSubtitle] = useState("Sur votre 1ère commande");
  const [badge, setBadge] = useState("OFFERT");
  const [template, setTemplate] = useState<Template>(TEMPLATES[0]);
  const [size, setSize] = useState<SizePreset>(SIZE_PRESETS[0]);
  const [exporting, setExporting] = useState(false);

  const applyPreset = (preset: PromoPreset) => {
    setHeadline(preset.headline);
    setSubtitle(preset.subtitle);
    setBadge(preset.badge);
  };

  const exportBanner = useCallback(async () => {
    if (!bannerRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(bannerRef.current, {
        width: size.width,
        height: size.height,
        pixelRatio: 2,
        style: {
          width: `${size.width}px`,
          height: `${size.height}px`,
        },
      });
      // Download
      const link = document.createElement("a");
      link.download = `promo-${badge.toLowerCase().replace(/\s+/g, "-")}-${size.width}x${size.height}.png`;
      link.href = dataUrl;
      link.click();
      onCreated?.(dataUrl);
      toast.success("Bannière téléchargée !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur d'export");
    } finally {
      setExporting(false);
    }
  }, [size, badge, onCreated]);

  // Scale factor for preview (fit in container)
  const previewMaxWidth = 560;
  const previewScale = Math.min(1, previewMaxWidth / size.width);

  return (
    <div className="space-y-5">
      {/* Promo presets */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1">
          <Sparkles size={12} /> Offres prêtes à l&apos;emploi
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PROMO_PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 rounded-lg text-xs bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {p.badge} — {p.headline}
            </button>
          ))}
        </div>
      </div>

      {/* Text inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
            <Type size={12} /> Titre principal
          </label>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Ex: Frais de commande offerts"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Sous-titre</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Ex: Sur votre 1ère commande"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Badge / Réduction</label>
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="Ex: -20%, OFFERT, GRATUIT"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Template selector */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1">
          <Palette size={12} /> Style
        </label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t)}
              className={`relative w-10 h-10 rounded-xl border-2 transition-all ${
                template.id === t.id ? "border-red-600 scale-110 shadow-lg" : "border-gray-200 dark:border-white/10"
              }`}
              style={{ background: t.bg }}
              title={t.name}
            >
              {template.id === t.id && (
                <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Size selector */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1">
          <Maximize size={12} /> Format
        </label>
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSize(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                size.id === s.id
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE PREVIEW */}
      <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-gray-50 dark:bg-white/5 p-4">
        <p className="text-xs text-gray-400 mb-2">Aperçu ({size.width}×{size.height})</p>
        <div
          style={{
            width: size.width * previewScale,
            height: size.height * previewScale,
            overflow: "hidden",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}
        >
          <div
            ref={bannerRef}
            style={{
              width: size.width,
              height: size.height,
              background: template.bg,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: size.width * 0.06,
              fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
              overflow: "hidden",
            }}
          >
            {/* Decorative circles */}
            <div
              style={{
                position: "absolute",
                top: -size.height * 0.2,
                right: -size.width * 0.1,
                width: size.width * 0.4,
                height: size.width * 0.4,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -size.height * 0.15,
                left: -size.width * 0.08,
                width: size.width * 0.3,
                height: size.width * 0.3,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
              }}
            />

            {/* Badge */}
            {badge && (
              <div
                style={{
                  background: template.badgeColor,
                  color: template.badgeText,
                  padding: `${size.width * 0.012}px ${size.width * 0.035}px`,
                  borderRadius: size.width * 0.015,
                  fontSize: size.width * 0.035,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  marginBottom: size.height * 0.03,
                  textTransform: "uppercase",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                }}
              >
                {badge}
              </div>
            )}

            {/* Headline */}
            <div
              style={{
                color: template.textColor,
                fontSize: Math.min(size.width * 0.065, size.height * 0.12),
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.15,
                maxWidth: "85%",
                textShadow: "0 2px 10px rgba(0,0,0,0.2)",
              }}
            >
              {headline}
            </div>

            {/* Subtitle */}
            {subtitle && (
              <div
                style={{
                  color: template.textColor,
                  opacity: 0.8,
                  fontSize: Math.min(size.width * 0.03, size.height * 0.05),
                  fontWeight: 500,
                  textAlign: "center",
                  marginTop: size.height * 0.02,
                  maxWidth: "70%",
                }}
              >
                {subtitle}
              </div>
            )}

            {/* Klik&Go logo watermark */}
            <div
              style={{
                position: "absolute",
                bottom: size.height * 0.04,
                display: "flex",
                alignItems: "center",
                gap: size.width * 0.008,
                opacity: 0.6,
              }}
            >
              <div
                style={{
                  width: size.width * 0.022,
                  height: size.width * 0.022,
                  borderRadius: "50%",
                  background: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: size.width * 0.013,
                  fontWeight: 800,
                }}
              >
                K
              </div>
              <span
                style={{
                  color: template.textColor,
                  fontSize: size.width * 0.018,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                Klik&Go
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={exportBanner}
          disabled={exporting || !headline}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {exporting ? (
            <RotateCcw size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          Télécharger PNG
        </button>
      </div>
    </div>
  );
}
