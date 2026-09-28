# Locations de verdade, incluídas de dentro de um `server {}` (default.conf)
# — extensão .inc de propósito: o nginx oficial carrega `conf.d/*.conf`
# sozinho, e um arquivo só com `location` (sem `server {}` em volta) nesse
# glob quebraria o nginx inteiro na subida.
client_max_body_size 1m;

location /api/mapas {
  # Editor de mapas/painel admin — mesmo processo do jogo (sem segunda
  # instância), mas nunca exposto ao público: só quem chega via túnel SSH
  # (`ssh -L 8080:127.0.0.1:80 usuario@vps`, depois acessar
  # http://localhost:8080/api/mapas/... local).
  #
  # Não basta `allow 127.0.0.1`: uma conexão do próprio host para uma porta
  # PUBLICADA do Docker (é exatamente o que o túnel SSH faz) sofre NAT
  # hairpin — o nginx enxerga o cliente como o gateway da bridge do Docker
  # (172.17-31.x.1), não como 127.0.0.1. Esse bloco inteiro (172.16.0.0/12)
  # é só endereço interno de bridge do Docker: nunca chega roteado da
  # internet, e um atacante remoto não completa handshake TCP forjando esse
  # source — não dá pra receber o SYN-ACK de volta.
  allow 172.16.0.0/12;
  allow 127.0.0.1;
  allow ::1;
  deny all;

  proxy_pass http://game;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /ws {
  proxy_pass http://game;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  # Uma sessão de jogo fica horas conectada — sem isto o nginx derruba o
  # WebSocket depois de 60s parado (nada de anormal: o jogo só manda quadro
  # quando tem tique pra mandar).
  proxy_read_timeout 1h;
  proxy_send_timeout 1h;
  limit_conn conexoes_por_ip 20;
}

location / {
  proxy_pass http://game;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  # burst alto de propósito: este cliente é ~90+ requests separados por
  # carregamento frio (módulos ES não empacotados, sem bundler) — tudo isso
  # chega em paralelo em poucos ms. `nodelay` serve esse burst inteiro na
  # hora (sem isso, o nginx enfileiraria e atrasaria cada request extra em
  # vez de 503ar, o que também travaria a página, só que mais devagar). O
  # limite de VELOCIDADE sustentada continua 20r/s — isto só alarga a
  # tolerância para o pico de UM carregamento de página, não para abuso
  # contínuo.
  limit_req zone=http_por_ip burst=200 nodelay;
  # Em HTTP/2 (o `:443` desta stack) o `limit_conn` conta cada REQUEST em
  # andamento, não cada conexão TCP: o Chrome abre o carregamento frio numa
  # conexão só, com dezenas de streams em paralelo, e os arquivos grandes
  # (city.png 9,5 MB, city-map.json 3,7 MB) seguram os seus abertos por
  # segundos. Com 20, o 21º em diante voltava 503 ("limiting connections by
  # zone conexoes_por_ip", visto em produção 2026-09-28) e a página ficava
  # presa em "acordando o servidor…". 128 = o `http2_max_concurrent_streams`
  # padrão do nginx: um navegador sozinho nunca passa disso, e o abuso
  # sustentado continua barrado pelo `limit_req` acima. O `/ws` segue com 20.
  limit_conn conexoes_por_ip 128;
}
