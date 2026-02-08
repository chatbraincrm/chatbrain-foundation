# -----------------------------------------------------------------------------
# Stage 1: Build frontend (Vite)
# Pass VITE_* via build-args (docker compose injects from .env)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Web (Nginx serving static + proxy /api to api)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS web
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Stage 3: API (Node Express - webhook + invite email)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS api
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci
COPY server ./server
COPY src ./src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
RUN npm run build 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["npx", "tsx", "-r", "tsconfig-paths/register", "server/index.ts"]
