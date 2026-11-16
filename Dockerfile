FROM node:20-bookworm

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npx vite build --config vite.config.prod.ts && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --alias:@shared=./shared

ENV NODE_ENV=production

CMD ["sh", "-c", "npm run db:push && npm run start"]
