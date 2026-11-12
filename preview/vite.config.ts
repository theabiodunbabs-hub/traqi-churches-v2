import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Single-file preview of the app (demo data, no backend) for sharing as one HTML page.
export default defineConfig({
  root: here("."),
  plugins: [react(), viteSingleFile()],
  // The preview always runs on demo data, never against a live database.
  define: { "process.env.NEXT_PUBLIC_SUPABASE_URL": "undefined", "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "undefined" },
  resolve: {
    alias: [
      { find: "next/link", replacement: here("./shims/link.tsx") },
      { find: "next/navigation", replacement: here("./shims/navigation.ts") },
      { find: /^@\//, replacement: here("../src/") },
    ],
  },
  build: { outDir: here("../preview-dist"), emptyOutDir: true, assetsInlineLimit: 100_000_000 },
});
