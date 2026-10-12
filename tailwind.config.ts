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
        brand: { from: "#191919", to: "#b41636", red: "#b41636", light: "#f9e8ed", ink: "#141414" },
        // The estate palette of the public web (see components/landing/palette.ts).
        estate: { forest: "#b41636", deep: "#810d25", moss: "#a51633", sage: "#e9a5b4", cream: "#ffffff", sand: "#f7f7f7", line: "#e6e6e6", ink: "#161616", muted: "#666666", lime: "#ffffff", sun: "#f5f5f5" },
      },
      boxShadow: { 'sh-sm': '0 3px 12px -5px rgba(19,42,30,.16)', 'sh-md': '0 16px 36px -18px rgba(19,42,30,.27)', 'sh-lg': '0 30px 72px -32px rgba(19,42,30,.36)' },
      borderRadius: { 'sh-sm': '12px', 'sh-md': '18px', 'sh-lg': '28px' },
      transitionTimingFunction: { sh: 'cubic-bezier(.2,.8,.2,1)' },
      borderColor: { DEFAULT: "hsl(var(--border))" },
    },
  },
  plugins: [],
} satisfies Config;
