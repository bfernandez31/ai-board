FROM oven/bun:1.1.38-alpine

WORKDIR /app

# Install git and other dependencies
RUN apk add --no-cache git bash

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create workspaces directory
RUN mkdir -p /workspaces

# Run the worker
CMD ["bun", "run", "src/index.ts"]