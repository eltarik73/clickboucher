// src/app/webmaster/banners/page.tsx — Site banner management
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  Plus,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Image as ImageIcon,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/banners");
      if (res.ok) {
        const json = await res.json();
        setBanners(json.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const createBanner = async () => {
    if (!title || !imageUrl) {
      toast.error("Titre et image requis");
      return;
    }
    try {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle: subtitle || null,
          imageUrl,
          linkUrl: linkUrl || null,
          position: banners.length,
        }),
      });
      if (res.ok) {
        toast.success("Bannière créée");
        setTitle("");
        setSubtitle("");
        setImageUrl("");
        setLinkUrl("");
        setShowCreate(false);
        fetchBanners();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  const toggleBanner = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/banners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? "Bannière désactivée" : "Bannière activée");
        fetchBanners();
      }
    } catch {
      toast.error("Erreur");
    }
  };

  const deleteBanner = async (id: string) => {
    if (!confirm("Supprimer cette bannière ?")) return;
    try {
      const res = await fetch("/api/admin/banners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Bannière supprimée");
        fetchBanners();
      }
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/marketing" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon size={24} className="text-red-600" />
            Bannières du site
          </h1>
          <p className="text-sm text-gray-500">Gérer les bannières promotionnelles de l&apos;accueil</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700"
        >
          <Plus size={16} /> Nouvelle
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5 space-y-4">
          <h3 className="font-bold text-sm">Nouvelle bannière</h3>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la bannière"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
          />
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Sous-titre (optionnel)"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="URL de l'image"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
            />
          </div>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Lien (optionnel, ex: /)"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
          />


          <button
            onClick={createBanner}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm"
          >
            Créer la bannière
          </button>
        </div>
      )}

      {/* Banner list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-red-600" size={24} />
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
          <p>Aucune bannière créée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-4 bg-white dark:bg-[#141414] rounded-2xl border p-4 ${
                b.isActive
                  ? "border-gray-200 dark:border-white/10"
                  : "border-gray-100 dark:border-white/5 opacity-60"
              }`}
            >
              <GripVertical size={16} className="text-gray-300 cursor-grab" />

              <div className="w-24 h-14 rounded-lg bg-gray-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{b.title}</p>
                {b.subtitle && <p className="text-xs text-gray-400 truncate">{b.subtitle}</p>}
                {b.linkUrl && <p className="text-xs text-blue-500 truncate">{b.linkUrl}</p>}
              </div>

              <button onClick={() => toggleBanner(b.id, b.isActive)} className="p-2">
                {b.isActive ? (
                  <ToggleRight size={24} className="text-green-500" />
                ) : (
                  <ToggleLeft size={24} className="text-gray-300" />
                )}
              </button>

              <button onClick={() => deleteBanner(b.id)} className="p-2 text-red-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
