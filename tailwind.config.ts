import type { Config } from "tailwindcss";

/**
 * QORB brand board. Teal + coral on deep navy, straight from qorb.fun:
 * gradients, rounded corners, glow shadows, Inter with heavy weights. The
 * palette keys keep the fork's legacy slot names (canvas/surface/ink/yolk/…)
 * so every component reskins automatically; the VALUES are the brand:
 *
 *   canvas/950…700          navy surfaces (#0a0a0a → #16213e family)
 *   ink / shell             white headlines / slate body text (#e2e8f0)
 *   yolk / grass            QORB teal (#20b2aa) — primary actions
 *   orange                  QORB coral (#ff6b47) — secondary accent
 *   sky                     teal-blue (#17a2b8) — links
 *   straw / wood            navy hairlines / slate muted text (#94a3b8)
 *
 * emerald/red hold the up/down colors (#10b981 / #ef4444) so buys and sells
 * render on-brand without touching component markup.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-stbl-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        stbl: {
          /** Page + panel surfaces (navy family) */
          canvas: "#0a0a0a",
          surface: "#131c33",
          "surface-warm": "#1a2440",
          /** Dark scale — cards, wallet modal, contrast blocks */
          950: "#0a0f1e",
          900: "#121a30",
          800: "#1a2440",
          700: "#263455",
          ink: "#ffffff",
          yolk: "#20b2aa",
          "yolk-soft": "#0d3b3f",
          orange: "#ff6b47",
          "orange-soft": "#3b1d16",
          sky: "#17a2b8",
          "sky-soft": "#0c2f3d",
          straw: "#263455",
          wood: "#94a3b8",
          grass: "#20b2aa",
          "grass-soft": "#0d3b3f",
          shell: "#e2e8f0",
        },
        emerald: {
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        red: {
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
