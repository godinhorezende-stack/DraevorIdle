# Locations de verdade, incluídas de dentro de um `server {}` (default.conf)
# — extensão .inc de propósito: o nginx oficial carrega `conf.d/*.conf`
# sozinho, e um arquivo só com `location` (sem `server {}` em volta) nesse
# glob quebraria o nginx inteiro na subida.
client_max_body_size 1m;

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
