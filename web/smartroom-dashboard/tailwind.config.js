/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#0B0F1A",
          900: "#121826",
          850: "#1A2236",
          800: "#1e2436",
          700: "#252d44",
        },
        line: "rgba(255, 255, 255, 0.08)",
        ink: {
          muted: "#A0AEC0",
          subtle: "#718096",
        },
        brand: {
          from: "#7C3AED",
          to: "#4F46E5",
          hoverFrom: "#8B5CF6",
          hoverTo: "#6366F1",
        },
        chart: {
          primary: "#8B5CF6",
          secondary: "#6366F1",
        },
        accent: {
          purple: "#a78bfa",
          pink: "#e879f9",
          coral: "#fb7185",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 24px 48px -12px rgba(0, 0, 0, 0.45)",
        glow: {
          emerald: "0 0 16px rgba(34, 197, 94, 0.35)",
          red: "0 0 16px rgba(239, 68, 68, 0.4)",
        },
      },
    },
  },
  plugins: [],
};
