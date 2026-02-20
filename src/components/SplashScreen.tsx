"use client";

import { useState, useEffect } from "react";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("splash-seen") === "true") return;
    setShowSplash(true);

    // 5.2s → start fade-out, 6.0s → hide
    const fadeTimer = setTimeout(() => setFadeOut(true), 5200);
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem("splash-seen", "true");
    }, 6000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // "lik&Go" split into individual characters for letter-by-letter reveal
  const letters = [
    { ch: "l", color: "white" },
    { ch: "i", color: "white" },
    { ch: "k", color: "white" },
    { ch: "&", color: "#DC2626" },
    { ch: "G", color: "#DC2626" },
    { ch: "o", color: "#DC2626" },
  ];

  // Tagline split into words for word-by-word reveal
  const taglineWords = ["Commandez", "·", "Récupérez", "·", "Savourez"];

  return (
    <>
      {showSplash && (
        <div
          className={`fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center transition-opacity duration-700 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Logo row */}
          <div className="splash-shake flex items-baseline select-none">
            {/* K — slides in 0→0.6s */}
            <span className="splash-k text-8xl font-black text-[#DC2626] leading-none">
              K
            </span>
            {/* Letters — stagger 80ms starting at 0.8s */}
            {letters.map((l, i) => (
              <span
                key={i}
                className="splash-letter text-4xl font-bold leading-none"
                style={{
                  color: l.color,
                  animationDelay: `${800 + i * 80}ms`,
                }}
              >
                {l.ch}
              </span>
            ))}
          </div>

          {/* Red separator line — 1.5s→2.2s */}
          <div className="splash-separator mt-4 w-20 h-[2px] bg-[#DC2626] origin-left" />

          {/* Tagline word-by-word — stagger 300ms starting at 2.2s */}
          <p className="mt-4 flex items-center gap-1.5">
            {taglineWords.map((word, i) => (
              <span
                key={i}
                className="splash-word text-xs text-white/30 tracking-widest uppercase"
                style={{
                  animationDelay: `${2200 + i * 200}ms`,
                }}
              >
                {word}
              </span>
            ))}
          </p>

          {/* Speed lines — stagger at 3.2s */}
          <div className="flex items-center gap-2 mt-5">
            <div
              className="splash-line w-8 h-[2px] bg-[#DC2626]/60 rounded-full"
              style={{ animationDelay: "3200ms" }}
            />
            <div
              className="splash-line w-12 h-[2px] bg-[#DC2626]/40 rounded-full"
              style={{ animationDelay: "3500ms" }}
            />
            <div
              className="splash-line w-6 h-[2px] bg-[#DC2626]/20 rounded-full"
              style={{ animationDelay: "3800ms" }}
            />
          </div>

          {/* Loading text — 4.2s→5.2s */}
          <div className="splash-loading mt-6 flex items-center gap-1">
            <span className="text-[11px] text-white/20 tracking-wider">
              Chargement
            </span>
            <span className="splash-dot text-[11px] text-white/20">...</span>
          </div>

          {/* Progress bar — 0→100% in 5.5s */}
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5">
            <div className="splash-bar h-full bg-[#DC2626]" />
          </div>

          <style jsx>{`
            /* ── K slide in: 0s → 0.6s ── */
            @keyframes slideIn {
              from {
                transform: translateX(-100vw);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
            .splash-k {
              opacity: 0;
              animation: slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
            }

            /* ── Screen shake: 0.6s → 0.8s ── */
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              15%  { transform: translateX(-6px); }
              30%  { transform: translateX(5px); }
              45%  { transform: translateX(-4px); }
              60%  { transform: translateX(3px); }
              75%  { transform: translateX(-2px); }
              90%  { transform: translateX(1px); }
            }
            .splash-shake {
              animation: shake 0.2s ease 0.6s both;
            }

            /* ── Letters fade in one-by-one: 0.8s, stagger 80ms ── */
            @keyframes letterIn {
              from {
                opacity: 0;
                transform: translateX(-8px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
            .splash-letter {
              opacity: 0;
              animation: letterIn 0.15s ease both;
              /* animationDelay set inline */
            }

            /* ── Separator line: 1.5s → 2.2s ── */
            @keyframes growLine {
              from { transform: scaleX(0); }
              to   { transform: scaleX(1); }
            }
            .splash-separator {
              transform: scaleX(0);
              animation: growLine 0.7s cubic-bezier(0.22, 1, 0.36, 1) 1.5s both;
            }

            /* ── Tagline words: 2.2s, stagger 200ms ── */
            @keyframes wordIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .splash-word {
              opacity: 0;
              animation: wordIn 0.35s ease both;
              /* animationDelay set inline */
            }

            /* ── Speed lines: 3.2s, stagger 300ms ── */
            @keyframes lineSlide {
              from {
                opacity: 0;
                transform: translateX(-20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
            .splash-line {
              opacity: 0;
              animation: lineSlide 0.4s ease both;
              /* animationDelay set inline */
            }

            /* ── Loading text: 4.2s ── */
            @keyframes loadingIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            .splash-loading {
              opacity: 0;
              animation: loadingIn 0.4s ease 4.2s both;
            }

            /* ── Pulsing dots ── */
            @keyframes pulse {
              0%, 100% { opacity: 0.2; }
              50%      { opacity: 0.6; }
            }
            .splash-dot {
              animation: pulse 0.8s ease-in-out 4.4s infinite;
            }

            /* ── Progress bar: 0→100% in 5.5s ── */
            @keyframes fillBar {
              from { width: 0%; }
              to   { width: 100%; }
            }
            .splash-bar {
              animation: fillBar 5.5s linear both;
            }
          `}</style>
        </div>
      )}
      {children}
    </>
  );
}
