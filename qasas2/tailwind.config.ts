import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: "#FDFCF8",
          100: "#F7F5EE",
          900: "#E6E2D0",
        },
        emerald: {
          500: "#10B981",
          600: "#059669",
          800: "#065F46",
          900: "#064E3B",
        },
        gold: {
          400: "#D4AF37",
          500: "#B8860B",
        },
        ink: {
          400: "#9CA3AF",
          500: "#6B7280",
          800: "#1F2937",
          900: "#111827",
        },
        care: "#BE123C",
        sorrow: "#4338CA",
        angry: "#B91C1C",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Merriweather", "serif"],
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
      animation: {
        blob: "blob 20s infinite alternate",
        shimmer: "shimmer 2s linear infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
