# ==============================================================================
# Wind Forecast Intelligence — Frontend Dockerfile
# Multi-stage production build: Node.js 20 build -> Nginx Alpine runtime
# ==============================================================================

# Stage 1: Build static assets using Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions and lockfile first to leverage layer cache
COPY package.json package-lock.json ./

# Clean production dependency installation adhering strictly to the lockfile
RUN npm ci

# Copy application source code and configuration files
COPY . .

# Build production bundle with TypeScript check (tsc -b && vite build)
RUN npm run build

# Stage 2: Lightweight production web server (Nginx Alpine)
FROM nginx:1.27-alpine

# Remove default Nginx welcome page configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration with reverse proxy routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
