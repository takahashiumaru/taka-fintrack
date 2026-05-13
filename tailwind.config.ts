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
          green: "#2DB87D",
          navy: "#1D4ED8",
          blue: "#2563EB",
          sky: "#0EA5E9",
          mint: "#EFF6FF",
          violet: "#38BDF8",
          coral: "#FB7185",
          amber: "#F59E0B",
          ink: "#0F172A",
        },
      },
      boxShadow: {
        soft: "0 24px 70px rgba(30, 41, 59, 0.12)",
        float: "0 18px 42px rgba(37, 99, 235, 0.16)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
