/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050914",
          900: "#070d1f",
          800: "#0b1530",
          700: "#0f1c40",
        },
        electric: {
          400: "#5fb8ff",
          500: "#2e8fff",
          600: "#1467e8",
          700: "#0b4bc0",
        },
        ice: {
          100: "#f3f8ff",
          200: "#dbe9ff",
        },
        gold: {
          400: "#ffd77a",
          500: "#f6bf4b",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(46,143,255,0.55)",
        "glow-gold": "0 0 40px -8px rgba(246,191,75,0.6)",
        "glow-red": "0 0 40px -8px rgba(220,38,38,0.6)",
        "inner-glass": "inset 0 1px 0 0 rgba(255,255,255,0.08)",
      },
      backgroundImage: {
        "radial-fade": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: 0.6, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.04)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
