import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Αναφορά σε CSS variables (όχι ακατέργαστα hex πια) — επιβεβαιωμένο: αυτό
        // επιτρέπει το admin να αλλάζει light/dark απλά αλλάζοντας τις τιμές των
        // μεταβλητών σε ένα σημείο (globals.css), χωρίς να αγγίξουμε κάθε component.
        // Το "<alpha-value>" διατηρεί λειτουργικά όλα τα υπάρχοντα bg-gold/10 κ.λπ.
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        card: "rgb(var(--color-card) / <alpha-value>)",
        cardBorder: "rgb(var(--color-card-border) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        goldSoft: "rgb(var(--color-gold-soft) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        muted2: "rgb(var(--color-muted-2) / <alpha-value>)",
        good: "rgb(var(--color-good) / <alpha-value>)",
        // Χρώματα κατάστασης για badges (Έγκυρη/Εκκρεμεί/Σε εξέλιξη κ.λπ.) — επιβεβαιωμένο,
        // από την παλέτα που ενέκρινε ο Isaak.
        okBg: "rgb(var(--color-ok-bg) / <alpha-value>)",
        okText: "rgb(var(--color-ok-text) / <alpha-value>)",
        pendingBg: "rgb(var(--color-pending-bg) / <alpha-value>)",
        pendingText: "rgb(var(--color-pending-text) / <alpha-value>)",
        infoBg: "rgb(var(--color-info-bg) / <alpha-value>)",
        infoText: "rgb(var(--color-info-text) / <alpha-value>)",
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
