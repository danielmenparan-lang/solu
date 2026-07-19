FROM node:22-alpine AS build
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json* .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY prisma ./prisma
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN npx prisma generate && chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000

CMD ["scripts/docker-entrypoint.sh"]
