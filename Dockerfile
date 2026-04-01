

FROM ghcr.io/remotion-dev/base:4

WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output (run `npm run build` before docker build)
COPY dist/ ./dist/

# Expose Hono server port
EXPOSE 4000

# Health check — used by Railway / Render.com / Trigger.dev
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]