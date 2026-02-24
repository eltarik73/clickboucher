"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { KlikLogo } from "@/components/ui/KlikLogo";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (
      pathname === "/onboarding" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up")
    ) return;
    if (sessionStorage.getItem("splash-seen") === "true") return;

    // Detect system dark mode
    setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);

    setShowSplash(true);

    // 4.2s → start fade-out, 5.0s → hide
    const fadeTimer = setTimeout(() => setFadeOut(true), 4200);
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem("splash-seen", "true");
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {showSplash && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-700 ${
            fadeOut ? "opacity-0" : "opacity-100"
          } ${isDark ? "splash-dark" : "splash-light"}`}
        >
          {/* Glow background for dark mode */}
          {isDark && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#DC2626]/15 rounded-full blur-[120px]" />
            </div>
          )}

          {/* Logo with shadow */}
          <div className="relative z-10 splash-logo-entrance">
            {isDark ? (
              <div className="relative">
                <div className="absolute inset-0 blur-2xl opacity-50 bg-[#DC2626] rounded-full scale-150" />
                <KlikLogo size={80} className="relative z-10 drop-shadow-2xl" />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 blur-xl opacity-25 bg-[#DC2626] rounded-full scale-125" />
                <KlikLogo size={80} className="relative z-10" />
              </div>
            )}
          </div>

          {/* Text: Klik&Go */}
          <div className="relative z-10 mt-5 splash-text-entrance flex items-baseline select-none">
            <span className={`text-5xl font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              Klik
            </span>
            <span className="text-5xl font-black tracking-tight text-[#DC2626]">
              &amp;
            </span>
            <span className={`text-5xl font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              Go
            </span>
          </div>

          {/* by TkS26 */}
          <p className="relative z-10 mt-2 splash-tagline text-xs tracking-widest text-gray-400">
            by TkS26
          </p>

          {/* Tagline */}
          <p className="relative z-10 mt-4 splash-tagline-delayed flex items-center gap-1.5">
            {["Commandez", "·", "Récupérez", "·", "Savourez"].map((word, i) => (
              <span
                key={i}
                className={`splash-word text-xs tracking-widest uppercase ${
                  isDark ? "text-white/30" : "text-gray-400"
                }`}
                style={{ animationDelay: `${1800 + i * 150}ms` }}
              >
                {word}
              </span>
            ))}
          </p>

          {/* Bouncing red arrow */}
          <div className="relative z-10 mt-6 splash-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#DC2626]">
              <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Progress bar */}
          <div className={`absolute bottom-0 left-0 w-full h-[2px] ${isDark ? "bg-white/5" : "bg-gray-200"}`}>
            <div className="splash-bar h-full bg-[#DC2626]" />
          </div>

          <style jsx>{`
            .splash-light {
              background: #ffffff;
            }
            .splash-dark {
              background: #0a0a0a;
            }

            /* Logo entrance */
            @keyframes logoIn {
              from { opacity: 0; transform: scale(0.5); }
              to   { opacity: 1; transform: scale(1); }
            }
            .splash-logo-entrance {
              opacity: 0;
              animation: logoIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
            }

            /* Text entrance */
            @keyframes textIn {
              from { opacity: 0; transform: translateY(15px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .splash-text-entrance {
              opacity: 0;
              animation: textIn 0.5s ease 0.7s both;
            }

            /* Tagline */
            .splash-tagline {
              opacity: 0;
              animation: textIn 0.4s ease 1.1s both;
            }
            .splash-tagline-delayed {
              opacity: 0;
              animation: textIn 0.4s ease 1.5s both;
            }

            /* Words stagger */
            @keyframes wordIn {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .splash-word {
              opacity: 0;
              animation: wordIn 0.3s ease both;
            }

            /* Bouncing arrow */
            @keyframes bounceArrow {
              0%, 100% { transform: translateY(0); }
              50%      { transform: translateY(8px); }
            }
            @keyframes arrowIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            .splash-arrow {
              opacity: 0;
              animation: arrowIn 0.3s ease 2.5s both, bounceArrow 1.2s ease-in-out 2.5s infinite;
            }

            /* Progress bar: 0→100% in 5s */
            @keyframes fillBar {
              from { width: 0%; }
              to   { width: 100%; }
            }
            .splash-bar {
              animation: fillBar 5s linear both;
            }
          `}</style>
        </div>
      )}
      {children}
    </>
  );
}
