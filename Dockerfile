FROM node:20-bookworm

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN echo 'import { defineConfig } from "vite"; \
import react from "@vitejs/plugin-react"; \
import path from "path"; \
export default defineConfig({ \
  plugins: [react()], \
  resolve: { \
    alias: { \
      "@": path.resolve(import.meta.dirname, "client", "src"), \
      "@shared": path.resolve(import.meta.dirname, "shared"), \
      "@assets": path.resolve(import.meta.dirname, "attached_assets") \
    } \
  }, \
  root: path.resolve(import.meta.dirname, "client"), \
  build: { \
    outDir: path.resolve(import.meta.dirname, "dist/public"), \
    emptyOutDir: true, \
    rollupOptions: { \
      external: ["html5-qrcode"] \
    } \
  } \
});' > vite.config.prod.ts

RUN npx vite build --config vite.config.prod.ts && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["sh", "-c", "npm run db:push && npm run start"]
