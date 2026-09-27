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
  limit_req zone=http_por_ip burst=40 nodelay;
  limit_conn conexoes_por_ip 20;
}
