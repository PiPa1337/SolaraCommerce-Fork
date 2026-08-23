import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

let gitHash = "dev";
try {
  gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* sin git */
}

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_HASH__: JSON.stringify(gitHash),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace("T", " ")),
  },
  optimizeDeps: {
    include: ["dexie", "react-dom/client"],
    noDiscovery: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 4173,
  },
});
