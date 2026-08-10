# Build do cliente (Vite) + bundle do servidor (esbuild) — precisa das
# devDependencies (vite, esbuild, tailwind etc).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Imagem final: só o servidor Express (já empacotado em dist/server.cjs) + o
# build estático do cliente + dependências de produção.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Boa parte da lógica financeira/comercial compara datas com o relógio local
# do container (mês corrente, "hoje"/"ontem" no Planejamento Financeiro etc).
# Sem tzdata o Alpine fica em UTC — 3h à frente de Brasília — o que bagunça
# essas comparações perto da meia-noite.
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
