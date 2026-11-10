FROM node:24.22.2-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
EXPOSE 8080
USER node
CMD ["node", "server.js"]
