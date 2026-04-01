# Use the official lightweight Node 22 image on Debian Bookworm
FROM node:22-bookworm-slim

WORKDIR /app

# Install all the necessary C++ libraries, headless Chromium, and FFMPEG
# This is exactly what Remotion needs to boot Chrome safely in the cloud
RUN apt-get update && apt-get install -y \
  ffmpeg \
  chromium \
  curl \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxrandr2 \
  libxshmfence1 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript code
RUN npm run build

# Expose port
EXPOSE 4000

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start the server
CMD ["npm", "run", "start"]