# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY app/client/package*.json ./
RUN npm install
COPY app/client/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
RUN apk add --no-cache dumb-init
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY app/server/package*.json ./
RUN npm install --omit=dev

COPY app/server/ ./
COPY --from=frontend-build /build/dist ./public

RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=3003
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3003/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
