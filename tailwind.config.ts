import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B1220",
        panel: "#0B1220",
        card: "#121B2E",
        cardBorder: "#1E2A42",
        gold: "#C9A15A",
        goldSoft: "#E0BE7A",
        muted: "#8B93A7",
        muted2: "#6B7690",
        good: "#8ED17A",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
