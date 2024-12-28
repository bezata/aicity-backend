FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Copy .env file
COPY .env .env

# Expose the port your app runs on
EXPOSE 3001
EXPOSE 3002

# Start the application
CMD ["bun", "run", "dev"]