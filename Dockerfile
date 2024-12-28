FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

FROM oven/bun:1

WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunjs

# Copy only the necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lockb ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src 
COPY --from=builder /app/node_modules ./node_modules

# Copy .env file
COPY .env .env

# Switch to non-root user
USER bunjs

# Expose the ports
EXPOSE 3001 3002

# Add health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application using the src directory
CMD ["bun", "run", "src/index.ts"]