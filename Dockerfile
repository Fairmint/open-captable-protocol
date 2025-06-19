# Use the official Node.js 18 image
FROM node:18

# Set working directory
WORKDIR /app

# Environment variables to avoid platform-specific esbuild bloat
ENV npm_config_platform=linux
ENV npm_config_arch=x64
ENV NODE_ENV=production

# Copy dependency definitions first to leverage Docker cache
COPY package.json yarn.lock ./

# Install dependencies
# Using --frozen-lockfile is best practice for CI/CD
RUN yarn install --frozen-lockfile --network-concurrency 5 --no-progress

# Copy app source and pre-built files
COPY . .

# Expose app port
EXPOSE 8080

# Run the pre-built application
CMD ["node", "dist/app.js"]
