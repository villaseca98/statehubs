import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // The app screens render whole sample agencies in jsdom; give them room on a busy machine.
    testTimeout: 30000,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "supabase/functions/_shared/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
    },
  },
});
