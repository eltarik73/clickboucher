"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Crown,
  Star,
  MessageSquare,
  Store,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronDown,
  Search,
  Users,
  Zap,
  Shield,
} from "lucide-react";

/* ─── types ─── */
interface SubInfo {
  plan: string;
  status: string;
}

interface ShopSub {
  id: string;
  name: string;
  subscription: SubInfo | null;
  _count: { orders: number };
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
  shop: { id: string; name: string };
}

interface RatingDist {
  rating: number;
  count: number;
}

interface ReviewStats {
  totalReviews: number;
  avgRating: number;
  distribution: RatingDist[];
}

interface ShopOption {
  id: string;
  name: string;
}

/* ─── helpers ─── */
const PLAN_CONFIG: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  STARTER: { label: "Starter", color: "bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300", icon: Zap },
  PRO: { label: "Pro", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400", icon: Shield },
  PREMIUM: { label: "Premium", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400", icon: Crown },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  TRIAL: { label: "Essai", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400" },
  ACTIVE: { label: "Actif", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  SUSPENDED: { label: "Suspendu", color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
  CANCELLED: { label: "Annulé", color: "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400" },
  PENDING: { label: "En attente", color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  EXPIRED: { label: "Expiré", color: "bg-red-200 dark:bg-red-500/10 text-red-600 dark:text-red-400" },
};

const STARS = [5, 4, 3, 2, 1];

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "rating_desc", label: "Note ↓" },
  { value: "rating_asc", label: "Note ↑" },
];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `Il y a ${months} mois`;
}

/* ================================================================== */
export default function WebmasterPlansPage() {
  /* ── Plans state ── */
  const [shops, setShops] = useState<ShopSub[]>([]);
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loadingPlans, setLoadingPlans] = useState(true);

  /* ── Reviews state ── */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [shopsList, setShopsList] = useState<ShopOption[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingFilter, setRatingFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Fetch plans ── */
  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch("/api/admin/shops");
      const d = await res.json();
      if (d.success) {
        setShops(d.data);
        // Count by plan
        const pc: Record<string, number> = { STARTER: 0, PRO: 0, PREMIUM: 0, NONE: 0 };
        const sc: Record<string, number> = {};
        for (const s of d.data) {
          const plan = s.subscription?.plan || "NONE";
          pc[plan] = (pc[plan] || 0) + 1;
          const st = s.subscription?.status || "NONE";
          sc[st] = (sc[st] || 0) + 1;
        }
        setPlanCounts(pc);
        setStatusCounts(sc);
        setShopsList(
          d.data
            .map((s: ShopSub) => ({ id: s.id, name: s.name }))
            .sort((a: ShopOption, b: ShopOption) => a.name.localeCompare(b.name))
        );
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  /* ── Fetch reviews ── */
  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    const params = new URLSearchParams();
    params.set("page", String(reviewPage));
    params.set("perPage", "20");
    if (ratingFilter) params.set("rating", ratingFilter);
    if (shopFilter) params.set("shopId", shopFilter);
    params.set("sort", sortBy);

    try {
      const res = await fetch(`/api/webmaster/reviews?${params}`);
      const d = await res.json();
      if (d.success) {
        setReviews(d.data.reviews);
        setReviewTotal(d.data.total);
        setReviewTotalPages(d.data.totalPages);
        setReviewStats(d.data.stats);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoadingReviews(false);
    }
  }, [reviewPage, ratingFilter, shopFilter, sortBy]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    setReviewPage(1);
  }, [ratingFilter, shopFilter, sortBy]);

  /* ── Delete review ── */
  const deleteReview = async (id: string) => {
    if (!confirm("Supprimer cet avis ? Cette action est irréversible.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/webmaster/reviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        setReviews((rs) => rs.filter((r) => r.id !== id));
        setReviewTotal((t) => t - 1);
        fetchReviews();
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setDeletingId(null);
    }
  };

  const totalShops = shops.length;

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Crown size={20} /> Plans & Avis
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Gestion des abonnements et modération des avis clients
        </p>
      </div>

      {/* ═══════ PLANS SECTION ═══════ */}
      <Section title="Répartition des plans" icon={Crown}>
        {loadingPlans ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        ) : (
          <>
            {/* Plan cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {(["STARTER", "PRO", "PREMIUM"] as const).map((plan) => {
                const cfg = PLAN_CONFIG[plan];
                const PlanIcon = cfg.icon;
                const count = planCounts[plan] || 0;
                const pct = totalShops > 0 ? ((count / totalShops) * 100).toFixed(0) : "0";
                return (
                  <div key={plan} className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
                    <PlanIcon size={20} className={`mx-auto mb-1 ${cfg.color.includes("text-") ? "" : "text-gray-500 dark:text-gray-400"}`} />
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{count}</div>
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-md inline-block ${cfg.color}`}>
                      {cfg.label}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{pct}%</div>
                  </div>
                );
              })}
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
                <Users size={20} className="mx-auto mb-1 text-gray-400 dark:text-gray-500" />
                <div className="text-lg font-bold text-gray-900 dark:text-white">{totalShops}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts)
                .filter(([, c]) => c > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400" };
                  return (
                    <div key={status} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                      {cfg.label} : {count}
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </Section>

      {/* ═══════ REVIEWS SECTION ═══════ */}
      <Section title="Avis clients" icon={MessageSquare}>
        {/* Review stats */}
        {reviewStats && (
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Average rating */}
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {reviewStats.avgRating.toFixed(1)}
              </div>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className={s <= Math.round(reviewStats.avgRating) ? "text-amber-400" : "text-gray-200 dark:text-gray-600"}
                      fill={s <= Math.round(reviewStats.avgRating) ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {reviewStats.totalReviews} avis
                </div>
              </div>
            </div>

            {/* Distribution bars */}
            <div className="flex-1 space-y-1">
              {STARS.map((star) => {
                const dist = reviewStats.distribution.find((d) => d.rating === star);
                const count = dist?.count || 0;
                const pct = reviewStats.totalReviews > 0 ? (count / reviewStats.totalReviews) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-4 text-right">{star}</span>
                    <Star size={10} className="text-amber-400" fill="currentColor" />
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          {/* Shop filter */}
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="">Toutes les boutiques</option>
            {shopsList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Rating filter pills */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setRatingFilter("")}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                !ratingFilter
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              Tous
            </button>
            {STARS.map((s) => (
              <button
                key={s}
                onClick={() => setRatingFilter(ratingFilter === String(s) ? "" : String(s))}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-full transition flex items-center gap-1 ${
                  ratingFilter === String(s)
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                {s}<Star size={10} fill="currentColor" />
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative ml-auto">
            <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Count */}
        <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          {reviewTotal} avis · Page {reviewPage}/{reviewTotalPages || 1}
        </div>

        {/* Review list */}
        {loadingReviews ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-50 dark:bg-white/[0.02] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">Aucun avis trouvé.</div>
        ) : (
          <div className="space-y-2">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={s <= review.rating ? "text-amber-400" : "text-gray-200 dark:text-gray-600"}
                          fill={s <= review.rating ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {review.user.firstName} {review.user.lastName.charAt(0)}.
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {timeAgo(review.createdAt)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {review.comment}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <Store size={10} />
                    {review.shop.name}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteReview(review.id)}
                  disabled={deletingId === review.id}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex-shrink-0"
                  title="Supprimer cet avis"
                >
                  {deletingId === review.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {reviewTotalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-3">
            <button
              onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
              disabled={reviewPage <= 1}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(reviewTotalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (reviewTotalPages <= 7) pageNum = i + 1;
              else if (reviewPage <= 4) pageNum = i + 1;
              else if (reviewPage >= reviewTotalPages - 3) pageNum = reviewTotalPages - 6 + i;
              else pageNum = reviewPage - 3 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setReviewPage(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-medium transition ${
                    reviewPage === pageNum
                      ? "bg-red-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setReviewPage((p) => Math.min(reviewTotalPages, p + 1))}
              disabled={reviewPage >= reviewTotalPages}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Crown;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4 md:p-5">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <Icon size={16} /> {title}
      </h2>
      {children}
    </div>
  );
}
