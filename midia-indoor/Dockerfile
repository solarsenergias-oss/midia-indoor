FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthcheck', (r) => r.statusCode === 200 || process.exit(1))"

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
