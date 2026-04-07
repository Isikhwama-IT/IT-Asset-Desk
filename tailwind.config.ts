import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      colors: {
        stone: {
          50: "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4",
          300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c",
          600: "#57534e", 700: "#44403c", 800: "#292524", 900: "#1c1917",
        },
        brand: {
          orange:       "#C04F28",
          "orange-dark":"#a8431f",
          "orange-light":"#f0d4c8",
          green:        "#415445",
          "green-dark": "#354839",
          "green-light":"#4f6655",
          charcoal:     "#414042",
          sage:         "#859474",
          "sage-light": "#C9D9A0",
          "sage-pale":  "#eef3e6",
        },
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        slideRight: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        pulseDot: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%":      { transform: "scale(1.5)", opacity: "0.6" },
        },
      },
      animation: {
        "fade-up":    "fadeUp 280ms ease forwards",
        "shimmer":    "shimmer 1.6s linear infinite",
        "scale-in":   "scaleIn 180ms ease forwards",
        "slide-right":"slideRight 220ms ease forwards",
        "pulse-dot":  "pulseDot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
