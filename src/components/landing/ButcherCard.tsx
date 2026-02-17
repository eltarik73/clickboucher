// src/components/landing/ButcherCard.tsx
"use client";

export interface Butcher {
  id: string;
  name: string;
  rating: number;
  distance: string;
  status: string;
  isExpress: boolean;
  image?: string | null;
}

interface Props {
  butcher: Butcher;
}

export function ButcherCard({ butcher }: Props) {
  return (
    <div className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden
      ${(butcher.status === "OPEN" || butcher.status === "BUSY")
        ? "border-[#E8E5E1] shadow-sm hover:shadow-lg hover:border-[#D5D0CA]"
        : "border-[#E8E5E1] opacity-60"
      }`}>
      
      {/* Image placeholder */}
      <div className="relative h-28 bg-gradient-to-br from-[#F5F3F0] to-[#EBE8E4] overflow-hidden">
        {butcher.image ? (
          <img src={butcher.image} alt={butcher.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C5C0BA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {butcher.status === "BUSY" ? (
            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B] text-white text-[10px] font-semibold shadow-sm">
              Occup&eacute;
            </span>
          ) : (butcher.status === "OPEN") ? (
            <span className="px-2 py-0.5 rounded-md bg-[#16A34A] text-white text-[10px] font-semibold shadow-sm">
              Ouvert
            </span>
          ) : (butcher.status === "PAUSED" || butcher.status === "AUTO_PAUSED") ? (
            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B] text-white text-[10px] font-semibold">
              Pause
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-[#6B6560] text-white text-[10px] font-semibold">
              Ferm&eacute;
            </span>
          )}
          {butcher.isExpress && (butcher.status === "OPEN" || butcher.status === "BUSY") && (
            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B] text-white text-[10px] font-semibold shadow-sm flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Express
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[#1A1A1A] text-[15px] leading-tight mb-1.5">
          {butcher.name}
        </h3>
        
        <div className="flex items-center gap-3 text-sm text-[#6B6560]">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="font-medium">{butcher.rating}</span>
          </div>
          {/* Distance */}
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{butcher.distance}</span>
          </div>
        </div>

        {/* CTA */}
        <button type="button" disabled={butcher.status === "CLOSED" || butcher.status === "VACATION"}
          className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
            ${(butcher.status === "OPEN" || butcher.status === "BUSY")
              ? "bg-[#1A1A1A] text-white hover:bg-[#333] active:scale-[0.98]"
              : "bg-[#F0EDEA] text-[#9C9590] cursor-not-allowed"
            }`}>
          {(butcher.status === "OPEN" || butcher.status === "BUSY") ? "Choisir cette boucherie" : "Actuellement ferm\u00e9e"}
        </button>
      </div>
    </div>
  );
}
