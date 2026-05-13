import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        taka: {
          green: "#22C55E",
          navy: "#1E293B",
          mint: "#DDFBEA",
          violet: "#D9C6FF",
          coral: "#FF6B6B",
          amber: "#F59E0B",
          ink: "#0F172A",
        },
      },
      boxShadow: {
        soft: "0 24px 70px rgba(30, 41, 59, 0.12)",
        float: "0 18px 42px rgba(88, 28, 135, 0.14)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
