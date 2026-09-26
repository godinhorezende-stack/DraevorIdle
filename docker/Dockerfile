# Imagem do jogo (server/) — nginx e postgres são imagens oficiais, não daqui.
# `assets_raw/` e `api-mapeada/` NÃO entram na imagem: o servidor lê os dois em
# runtime (caminhos relativos a `server/`, ver nucleo/estaticos.mjs e
# sistemas/bosses.mjs) — o docker-compose os monta como volume a partir do
# checkout do git, então um `git pull` novo já é visto sem reconstruir a imagem.
FROM node:22-slim AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
# Sem root: se alguém conseguir rodar código dentro do container (uma
# dependência comprometida, um bug de path traversal), não sai do usuário
# `jogo` — não escreve fora do que já é dele, não instala nada no sistema.
RUN useradd --system --create-home --shell /usr/sbin/nologin jogo
WORKDIR /app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server
RUN mkdir -p /app/server/dados /app/assets_raw /app/api-mapeada \
    && chown -R jogo:jogo /app
USER jogo
ENV NODE_ENV=production
EXPOSE 8080

# `/saude` (server/index.mjs) responde {"ok":true,"online":N} assim que o
# HTTP sobe — o compose usa isto pra só religar o nginx depois que o jogo
# aqui dentro está de pé de verdade (`depends_on: condition: service_healthy`).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORTA||8080)+'/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# SIGTERM aciona o handler de server/index.mjs (`for (sinal of [...])`) que
# grava todo mundo que está online antes de sair — o `stop_grace_period: 30s`
# do compose é o que dá tempo pra isso terminar antes do SIGKILL.
STOPSIGNAL SIGTERM

CMD ["node", "server/index.mjs"]
