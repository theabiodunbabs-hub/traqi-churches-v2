import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Only for the scripts in this folder (not part of npm test)
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  test: { include: ["scripts/**/*.test.ts"], root: fileURLToPath(new URL("..", import.meta.url)) },
});
