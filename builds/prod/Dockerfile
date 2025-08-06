FROM node:20-alpine

WORKDIR /app

# Install build dependencies for sharp, yt-dlp, and ffmpeg
RUN apk add --no-cache --virtual .gyp python3 make g++ libc6-compat py3-pip yt-dlp ffmpeg

# Install pnpm
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nitro -u 1001

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile && pnpm store prune
# Install sharp for Alpine Linux (musl)
RUN npm install --include=optional sharp && \
    npm install --os=linux --libc=musl --cpu=x64 sharp


# Copy Nitro build output
COPY .output/ ./output/

# Copy assets (including blank.jpg) for runtime use
COPY src/assets/ ./src/assets/


# Change ownership to non-root user
RUN chown -R nitro:nodejs /app
USER nitro

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "output/server/index.mjs"]
