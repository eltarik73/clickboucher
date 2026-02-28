"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(false);
  const [phase, setPhase] = useState<"visible" | "exiting" | "hidden">("visible");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (
      pathname === "/onboarding" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up")
    ) return;
    if (sessionStorage.getItem("splash-seen") === "true") return;

    // Read theme from ThemeProvider (.dark class on <html>)
    setIsDark(document.documentElement.classList.contains("dark"));

    setShowSplash(true);

    // 4s → start exit animation, 5s → hide completely
    const exitTimer = setTimeout(() => setPhase("exiting"), 4000);
    const hideTimer = setTimeout(() => {
      setPhase("hidden");
      setShowSplash(false);
      sessionStorage.setItem("splash-seen", "true");
    }, 5000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {showSplash && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${
            phase === "exiting" ? "splash-exit" : ""
          }`}
          style={{ background: isDark ? "#0a0a0a" : "#ffffff" }}
        >
          {/* Logo SVG (pas de composant externe — évite le carré rose) */}
          <div className="relative z-10 splash-logo-entrance">
            <svg viewBox="0 0 100 100" width={80} height={80} className="rounded-full drop-shadow-lg">
              <defs>
                <linearGradient id="splashLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a83320" />
                  <stop offset="50%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="#DC2626" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#splashLogoGrad)" />
              <path
                d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z"
                fill="white"
              />
              <rect x="76" y="33" width="14" height="3.5" rx="1.75" fill="white" opacity="0.7" />
              <rect x="79" y="43" width="16" height="3" rx="1.5" fill="white" opacity="0.5" />
              <rect x="76" y="53" width="12" height="2.5" rx="1.25" fill="white" opacity="0.3" />
            </svg>
          </div>

          {/* Text: Klik&Go */}
          <div className="relative z-10 mt-5 splash-text-entrance flex items-baseline select-none">
            <span
              className="text-5xl font-black tracking-tight"
              style={{ color: isDark ? "#fff" : "#111" }}
            >
              Klik
            </span>
            <span className="text-5xl font-black tracking-tight text-[#DC2626]">
              &amp;
            </span>
            <span
              className="text-5xl font-black tracking-tight"
              style={{ color: isDark ? "#fff" : "#111" }}
            >
              Go
            </span>
          </div>

          {/* Tagline */}
          <p className="relative z-10 mt-4 splash-tagline flex items-center gap-1.5">
            {["Commandez", "·", "Récupérez", "·", "Savourez"].map((word, i) => (
              <span
                key={i}
                className="splash-word text-xs tracking-widest uppercase"
                style={{
                  animationDelay: `${1800 + i * 150}ms`,
                  color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)",
                }}
              >
                {word}
              </span>
            ))}
          </p>

          {/* Progress bar */}
          <div
            className="absolute bottom-0 left-0 w-full h-[3px]"
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)" }}
          >
            <div className="splash-bar h-full bg-[#DC2626]" />
          </div>

          <style jsx>{`
            /* ─── Logo entrance ─── */
            @keyframes logoIn {
              from { opacity: 0; transform: scale(0.5); }
              to   { opacity: 1; transform: scale(1); }
            }
            .splash-logo-entrance {
              opacity: 0;
              animation: logoIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
            }

            /* ─── Text entrance ─── */
            @keyframes textIn {
              from { opacity: 0; transform: translateY(15px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .splash-text-entrance {
              opacity: 0;
              animation: textIn 0.5s ease 0.7s both;
            }

            /* ─── Tagline ─── */
            .splash-tagline {
              opacity: 0;
              animation: textIn 0.4s ease 1.5s both;
            }

            /* ─── Words stagger ─── */
            @keyframes wordIn {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .splash-word {
              opacity: 0;
              animation: wordIn 0.3s ease both;
            }

            /* ─── Progress bar: 0→100% in 5s ─── */
            @keyframes fillBar {
              from { width: 0%; }
              to   { width: 100%; }
            }
            .splash-bar {
              animation: fillBar 5s linear both;
            }

            /* ─── EXIT: zoom in + fade out ("enter the site") ─── */
            @keyframes exitZoom {
              from {
                opacity: 1;
                transform: scale(1);
              }
              to {
                opacity: 0;
                transform: scale(2.5);
              }
            }
            .splash-exit {
              animation: exitZoom 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
              pointer-events: none;
            }
          `}</style>
        </div>
      )}
      {children}
    </>
  );
}
