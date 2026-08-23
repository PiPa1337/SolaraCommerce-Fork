import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: {
        main: "src/main.mjs",
        preload: "src/preload.mjs",
        "agent-cli": "src/agent-cli.mjs",
      },
      formats: ["cjs"],
      fileName: (_, entryName) => `${entryName}.cjs`,
    },
    rollupOptions: {
      external: [/^electron$/, /^node:/],
    },
  },
});
