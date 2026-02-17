// src/app/(boucher)/boucher/dashboard/parrainage/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Share2, Gift, Check, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ReferralInfo = {
  code: string;
  referrals: { shopName: string; status: string; createdAt: string }[];
  maxReached: boolean;
};

export default function ParrainagePage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/boucher/referral")
      .then((r) => r.json())
      .then((json) => setInfo(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = useCallback(() => {
    if (!info?.code) return;
    const msg = `Rejoins Klik&Go pour ta boucherie ! Utilise mon code ${info.code} et on gagne chacun 1 mois gratuit. https://klikandgo.fr/inscription-boucher?ref=${info.code}`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      toast.success("Message copie !");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [info?.code]);

  const handleShare = useCallback(() => {
    if (!info?.code) return;
    const text = `Rejoins Klik&Go pour ta boucherie ! Utilise mon code ${info.code} et on gagne chacun 1 mois gratuit.`;
    const url = `https://klikandgo.fr/inscription-boucher?ref=${info.code}`;

    if (navigator.share) {
      navigator.share({ title: "Parrainage Klik&Go", text, url }).catch(() => {});
    } else {
      handleCopy();
    }
  }, [info?.code, handleCopy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#DC2626]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Link
            href="/boucher/dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Parrainage</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-5">
        {/* Reward info */}
        <div className="bg-gradient-to-br from-[#DC2626] to-[#b91c1c] rounded-2xl p-6 text-white">
          <Gift className="w-8 h-8 mb-3" />
          <h2 className="text-lg font-bold">Parrainez un boucher</h2>
          <p className="text-sm opacity-90 mt-1">
            Gagnez <span className="font-bold">1 mois gratuit</span> pour vous et votre filleul !
          </p>
          <p className="text-xs opacity-75 mt-2">
            Partagez votre code, votre filleul l&apos;utilise lors de son inscription. Une fois validé par l&apos;admin, vous recevez tous les deux 1 mois offert.
          </p>
        </div>

        {/* Code */}
        {info?.code && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Votre code de parrainage</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 font-mono text-lg font-bold text-gray-900 dark:text-white tracking-wider">
                {info.code}
              </div>
              <button
                onClick={handleCopy}
                className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center text-white hover:bg-[#b91c1c] transition-colors"
              >
                <Share2 size={18} />
              </button>
            </div>
            {info.maxReached && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Maximum de 10 parrainages atteint
              </p>
            )}
          </div>
        )}

        {/* Referrals list */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Mes filleuls ({info?.referrals?.length || 0}/10)
            </h3>
          </div>

          {info?.referrals && info.referrals.length > 0 ? (
            <div className="space-y-2">
              {info.referrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#ece8e3] dark:border-white/10 last:border-0">
                  <span className="text-sm text-gray-900 dark:text-white">{r.shopName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === "rewarded" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {r.status === "rewarded" ? "Récompensé" : "En attente"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              Aucun filleul pour le moment
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
