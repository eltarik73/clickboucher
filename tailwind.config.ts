import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import { FONT_SIZE_SCALE, RADIUS_SCALE, SHADOW_SCALE } from "./src/lib/design-tokens";

// Valeurs des couleurs : variables CSS de src/styles/globals.css ('H S% L%', jamais d'alpha).
// Échelles fontSize / boxShadow / borderRadius : src/lib/design-tokens.ts, lues aussi par cn().
// Animations : ce fichier est leur seule définition (globals.css ne garde que flashGreen / flashRed).
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{ts,tsx}",
    "!./src/lib/**/__tests__/**",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        page: "hsl(var(--page))",
        brand: "hsl(var(--brand))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          hover: "hsl(var(--destructive-hover))",
          foreground: "hsl(var(--destructive-foreground))",
          subtle: "hsl(var(--destructive-subtle))",
          text: "hsl(var(--destructive-text))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          hover: "hsl(var(--success-hover))",
          foreground: "hsl(var(--success-foreground))",
          subtle: "hsl(var(--success-subtle))",
          text: "hsl(var(--success-text))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          hover: "hsl(var(--warning-hover))",
          foreground: "hsl(var(--warning-foreground))",
          subtle: "hsl(var(--warning-subtle))",
          text: "hsl(var(--warning-text))",
        },
        info: {
          subtle: "hsl(var(--info-subtle))",
          text: "hsl(var(--info-text))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        ...RADIUS_SCALE,
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      fontSize: FONT_SIZE_SCALE,
      boxShadow: SHADOW_SCALE,
      animation: {
        "fade-in": "fade-in 0.35s ease both",
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "pulse-slow": "pulse-soft 2s ease-in-out infinite",
        "bounce-gentle": "bounce-gentle 1.5s ease-in-out infinite",
        ring: "ring 1.5s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Nom conservé : ShopProductsClient.tsx utilise animate-[slideUp_0.3s_ease-out].
        slideUp: {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        ring: {
          "0%": { transform: "rotate(0)" },
          "10%": { transform: "rotate(15deg)" },
          "20%": { transform: "rotate(-15deg)" },
          "30%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-10deg)" },
          "50%": { transform: "rotate(5deg)" },
          "60%, 100%": { transform: "rotate(0)" },
        },
        // background-size porté par l'animation : animate-shimmer suffit, sans classe compagnon.
        shimmer: {
          from: { backgroundPosition: "-200% 0", backgroundSize: "200% 100%" },
          to: { backgroundPosition: "200% 0", backgroundSize: "200% 100%" },
        },
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
        "nav-height": "5rem",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
