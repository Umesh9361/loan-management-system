import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { localizeUiSource } from "./scripts/ui-localization";

export default defineConfig({
  plugins: [
    {
      name: "source-authored-ui-language",
      enforce: "pre",
      transform(code, id) {
        if ((!id.includes("/client/src/") && !/\/shared\/account-summary(?:-format)?\.ts$/.test(id)) || id.includes("node_modules")) return;
        const transformed = localizeUiSource(code, id.split("?")[0]);
        return transformed === code ? undefined : { code: transformed, map: null };
      },
    },
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
