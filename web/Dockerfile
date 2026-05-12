FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS final
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist/magna-readacross-web/browser/ ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
