# Backend API Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend code
COPY backend/ ./backend/

# Create data directory for JSON fallback
RUN mkdir -p data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start server
CMD ["node", "backend/server.js"]
