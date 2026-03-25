# Multi-stage build for Node.js backend (monorepo structure)
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./

# Copy backend package files
COPY packages/backend/package*.json ./packages/backend/
COPY packages/backend/prisma ./packages/backend/prisma/
COPY packages/backend/tsconfig.json ./packages/backend/

# Install all dependencies (including workspace)
RUN npm install

# Generate Prisma client
WORKDIR /app/packages/backend
RUN npx prisma generate

# Copy backend source code
COPY packages/backend/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/package*.json ./
COPY --from=builder /app/packages/backend/prisma ./prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/app.js"]
