"use client";

import { useState, useEffect } from "react";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("splash-seen") === "true") return;
    setShowSplash(true);

    const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem("splash-seen", "true");
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {showSplash && (
        <div
          className={`fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center transition-opacity duration-300 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Logo */}
          <div className="flex items-baseline select-none">
            <span className="splash-k text-8xl font-black text-[#DC2626] leading-none">
              K
            </span>
            <span className="splash-text text-4xl font-bold leading-none">
              <span className="text-white">lik</span>
              <span className="text-[#DC2626]">&amp;Go</span>
            </span>
          </div>

          {/* Tagline */}
          <p className="splash-tagline mt-5 text-xs text-white/30 tracking-widest uppercase">
            Commandez &middot; Recuperez &middot; Savourez
          </p>

          {/* Speed lines */}
          <div className="splash-lines flex items-center gap-2 mt-4">
            <div className="w-8 h-[2px] bg-[#DC2626]/60 rounded-full" />
            <div className="w-12 h-[2px] bg-[#DC2626]/40 rounded-full" />
            <div className="w-6 h-[2px] bg-[#DC2626]/20 rounded-full" />
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5">
            <div className="splash-bar h-full bg-[#DC2626]" />
          </div>

          <style jsx>{`
            @keyframes slideIn {
              from { transform: translateX(-100vw); }
              to   { transform: translateX(0); }
            }
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20%  { transform: translateX(-4px); }
              40%  { transform: translateX(4px); }
              60%  { transform: translateX(-2px); }
              80%  { transform: translateX(2px); }
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateX(-8px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes taglineFade {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes linesFade {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            @keyframes fillBar {
              from { width: 0%; }
              to   { width: 100%; }
            }

            .splash-k {
              animation:
                slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                shake 0.3s ease 0.4s;
            }
            .splash-text {
              opacity: 0;
              animation: fadeIn 0.4s ease 0.6s forwards;
            }
            .splash-tagline {
              opacity: 0;
              animation: taglineFade 0.5s ease 1s forwards;
            }
            .splash-lines {
              opacity: 0;
              animation: linesFade 0.4s ease 1.5s forwards;
            }
            .splash-bar {
              animation: fillBar 2.5s linear forwards;
            }
          `}</style>
        </div>
      )}
      {children}
    </>
  );
}
