# Imagem do jogo — nginx e postgres são imagens oficiais, não daqui. Contexto
# de build é a RAIZ do repo (ver `docker-compose.yml`, `context: ../..`): é o
# único jeito de alcançar `package.json` (raiz) e os `game/*` de código ao
# mesmo tempo.
#
# `game/frontend/`, `game/gamedata/` e `api-mapeada/` NÃO entram na imagem: o
# servidor lê os três em runtime (ver game/backend/index.mjs e
# game/systems/bosses.mjs) — o docker-compose os monta como volume a partir
# do checkout do git, então um `git pull` novo já é visto sem reconstruir a
# imagem.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
# Sem root: se alguém conseguir rodar código dentro do container (uma
# dependência comprometida, um bug de path traversal), não sai do usuário
# `jogo` — não escreve fora do que já é dele, não instala nada no sistema.
RUN useradd --system --create-home --shell /usr/sbin/nologin jogo
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Só o código — nunca conteúdo (frontend/gamedata, ver acima) nem testes.
COPY game/backend ./game/backend
COPY game/engine ./game/engine
COPY game/database ./game/database
COPY game/websocket ./game/websocket
COPY game/systems ./game/systems
COPY game/admin ./game/admin
RUN mkdir -p /app/game/database/dados /app/game/frontend /app/game/gamedata /app/api-mapeada \
    && chown -R jogo:jogo /app
USER jogo
ENV NODE_ENV=production
EXPOSE 8080

# `/saude` (game/backend/index.mjs) responde {"ok":true,"online":N} assim que
# o HTTP sobe — o compose usa isto pra só religar o nginx depois que o jogo
# aqui dentro está de pé de verdade (`depends_on: condition: service_healthy`).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORTA||8080)+'/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# SIGTERM aciona o handler de game/backend/index.mjs (`for (sinal of [...])`)
# que grava todo mundo que está online antes de sair — o `stop_grace_period:
# 30s` do compose é o que dá tempo pra isso terminar antes do SIGKILL.
STOPSIGNAL SIGTERM

CMD ["node", "game/backend/index.mjs"]
