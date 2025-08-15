# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app

# Optional (only if nc is missing at runtime):
# RUN apk add --no-cache busybox-extras

COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/. .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]