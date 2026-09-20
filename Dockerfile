FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Постоянный том для SQLite базы данных (quiz.db) и резервных копий
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
