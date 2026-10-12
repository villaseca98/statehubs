import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        // Elegant titles of the public web (system serifs: no font to download).
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', "Palatino", '"Book Antiqua"', "Georgia", "ui-serif", "serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        popover: "hsl(var(--card))",
        border: "hsl(var(--border))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "#fff" },
        ink: "hsl(var(--ink))",
        // The logo's colours (BRAND in _shared/blueprint/look.ts), for the public web.
        brand: { from: "#1e3a2b", to: "#3f8060", red: "#1f5c45", light: "#a8d6b2", ink: "#17231b" },
        // The estate palette of the public web (see components/landing/palette.ts).
        estate: { forest: "#1e3a2b", deep: "#132a1e", moss: "#2f5a41", sage: "#8fae8b", cream: "#f4f2ec", sand: "#e9e5da", line: "#e2ded2", ink: "#17231b", muted: "#5f6a61", lime: "#d4ec7a", sun: "#f2cf63" },
      },
      boxShadow: { 'sh-sm': '0 3px 12px -5px rgba(19,42,30,.16)', 'sh-md': '0 16px 36px -18px rgba(19,42,30,.27)', 'sh-lg': '0 30px 72px -32px rgba(19,42,30,.36)' },
      borderRadius: { 'sh-sm': '12px', 'sh-md': '18px', 'sh-lg': '28px' },
      transitionTimingFunction: { sh: 'cubic-bezier(.2,.8,.2,1)' },
      borderColor: { DEFAULT: "hsl(var(--border))" },
    },
  },
  plugins: [],
} satisfies Config;
