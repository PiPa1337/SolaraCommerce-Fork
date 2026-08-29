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
    include: ["dexie", "react-dom/client", "react", "zod", "@phosphor-icons/react"],
    noDiscovery: false,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@phosphor-icons/react")) return "phosphor";
          if (id.includes("node_modules/zod/")) return "zod";
          if (id.includes("node_modules/react-dom/") || id.includes("node_modules/react/"))
            return "vendor";
          if (id.includes("node_modules/dexie/")) return "dexie";
          if (id.includes("@tanstack/react-table")) return "table";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 4173,
  },
});
