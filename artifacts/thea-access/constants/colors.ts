/**
 * Semantic design tokens for THEA Access.
 *
 * Concept: "Secure Threshold" — a premium access-control aesthetic built on a
 * deep indigo/violet foundation with a single luminous cyan accent, echoing a
 * scanning beam. Grant/deny states read instantly via success/destructive.
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#14131a",
    tint: "#5b4bff",

    background: "#f6f6fb",
    foreground: "#14131a",

    card: "#ffffff",
    cardForeground: "#14131a",

    primary: "#5b4bff",
    primaryForeground: "#ffffff",

    secondary: "#ecebf6",
    secondaryForeground: "#2a2740",

    muted: "#eceaf4",
    mutedForeground: "#6b6880",

    accent: "#e4f8fd",
    accentForeground: "#0b7285",

    destructive: "#e11d48",
    destructiveForeground: "#ffffff",

    success: "#15a35b",
    successForeground: "#ffffff",

    warning: "#d97706",
    warningForeground: "#ffffff",

    border: "#e5e3f0",
    input: "#e5e3f0",
  },

  dark: {
    text: "#f4f3fb",
    tint: "#7c6bff",

    background: "#0b0a12",
    foreground: "#f4f3fb",

    card: "#16141f",
    cardForeground: "#f4f3fb",

    primary: "#7c6bff",
    primaryForeground: "#ffffff",

    secondary: "#1e1b2b",
    secondaryForeground: "#d9d6ea",

    muted: "#1a1826",
    mutedForeground: "#9995b0",

    accent: "#0e2a30",
    accentForeground: "#4be0f5",

    destructive: "#f43f5e",
    destructiveForeground: "#ffffff",

    success: "#22c55e",
    successForeground: "#04160b",

    warning: "#f59e0b",
    warningForeground: "#1a1200",

    border: "#262233",
    input: "#262233",
  },

  radius: 14,
};

export default colors;
