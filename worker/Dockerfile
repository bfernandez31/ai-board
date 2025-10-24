FROM oven/bun:1.1.38-alpine

WORKDIR /app

# Install required dependencies
# git: for repository operations
# bash: for running .specify scripts
# curl: for downloading images
# nodejs: for some npm packages that require it
RUN apk add --no-cache git bash curl nodejs npm

# Install Claude CLI globally
RUN bun add -g @anthropic-ai/claude-code

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create workspaces directory
RUN mkdir -p /workspaces

# Configure git globally (for commits)
RUN git config --global user.name "ai-board[bot]" && \
    git config --global user.email "bot@ai-board.app"

# Run the worker
CMD ["bun", "run", "src/index.ts"]