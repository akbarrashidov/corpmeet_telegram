# Build context: corpmeet_telegram/ (parent katalog)
# Sababi: package.json'da "@corpmeet/design": "file:../corpmeet_design"

FROM node:20-alpine AS builder

WORKDIR /build

# 1) Mahalliy file:-bog'liqlik (corpmeet_design)
COPY corpmeet_design /build/corpmeet_design

# 2) Webapp manifestlari (cache uchun alohida qadam)
COPY webapp/package.json webapp/package-lock.json /build/webapp/

WORKDIR /build/webapp
RUN npm ci

# 3) Qolgan webapp manbalari
COPY webapp /build/webapp

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY --from=builder /build/webapp/dist /usr/share/nginx/html

# SPA fallback - Telegram Web App va brauzer route'lari
RUN printf '%s\n' \
  'server {' \
  '    listen 80;' \
  '    server_name _;' \
  '    root /usr/share/nginx/html;' \
  '    index index.html;' \
  '    location / {' \
  '        try_files $uri $uri/ /index.html;' \
  '    }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]