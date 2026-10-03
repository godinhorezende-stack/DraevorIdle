# Server Save diário e proteção do offline farm

## 1. Auditoria: como o offline farm funciona de verdade

- **Início:** ao sair (fechar a aba, `release`, trocar de personagem), `Sessao.soltarPersonagem` grava `hunt.offlineDesde = agora` no JSON do personagem. O autosave de 30 s (`gravarAgora`) faz o mesmo na cópia gravada de quem está online, para sobreviver a uma queda do servidor.
- **Onde mora:** `personagens.estado` (JSON, campo `hunt`) + as colunas-índice `caca_offline_desde/ate` (`database/caca-offline.mjs`), escritas junto de TODA gravação de estado.
- **Não é simulação contínua em memória.** É calculada a partir do estado gravado: em pedaços a cada 10 min por `consolidacao-offline.mjs` (`UPDATE ... WHERE estado = <lido>`, idempotente) e o restante no login (`Cacadas.simularAusencia`). Nenhum timer, worker ou memória guarda o farm entre uma conta e outra; o worker (`simulacao-offline.mjs`) só calcula e devolve.
- **Tempo:** diferença entre `offlineDesde` e agora; `ausencia.inicio` guarda a saída real; teto de 12 h contado da saída (`AUSENCIA_MAXIMA_MS`) ou o fim da stamina (1 min por minuto), o que vier antes. Os primeiros 30 min são simulados tique a tique; o resto é projetado no ritmo medido.
- **XP/loot/recursos:** aplicados no próprio estado do personagem na consolidação/login (morte, poções e mana entram na simulação). Morte ou stamina zerada fecham a ausência (`ausencia.morreu/semStamina`).
- **Idempotência:** a consolidação só grava se o estado no banco ainda é o lido; o ponto `offlineDesde` anda para frente a cada pedaço, então o mesmo período nunca é contado duas vezes. Quem está no jogo (`estaNoJogo`) nunca é consolidado.
- **Diferenças:** conectado em hunt = estado da sessão, gravado a cada 30 s; offline = linha do banco; em instância = o estado da instância vai dentro do `hunt` gravado; entrando = `carregando` (a consolidação pula); recompensa pendente = tabela `creditos` (mercado/presentes), separada do `hunt`.

### Riscos de perda de progresso e estratégia
| Risco | Estratégia |
|---|---|
| Rotina de save sobrescrever o `estado` de um ausente com cópia velha | O save **nunca escreve `estado`** de ausente. Só atualiza colunas-índice derivadas, com `WHERE estado = <lido>` |
| Rotina "resetar" `offlineDesde` | Não toca; teste F1 confere o JSON byte a byte |
| Save concorrente com a consolidação/login | Sem escrita em `estado`, não há o que disputar (teste F7) |
| Servidor cair no meio | Nada fica pela metade: o save não tem fase destrutiva; o autosave já carimba `offlineDesde` |
| Save duplicado após reinício | Agenda calculada do relógio, ciclo reivindicado por `INSERT` único em `server_save_ciclos` |

## 2. O que o Server Save faz (`game/systems/server-save.mjs`)
Todo dia às **05:00 America/Sao_Paulo** (`SERVER_SAVE_HORA`, `SERVER_SAVE_TIMEZONE`), com avisos 5 e 1 minuto antes (mensagens exatas em `server-save-config.mjs`):
1. grava os jogadores conectados do processo (`gravarAgora`, em lotes);
2. o processo que ganhou o ciclo varre os ausentes (só leitura; conserta apenas coluna-índice divergente; anomalias são relatadas);
3. conta recompensas pendentes (leitura) e faz checkpoint passivo do WAL (SQLite);
4. registra o ciclo; só então avisa "concluído". Falha → mensagem de falha, o ciclo fica `falhou`, a agenda segue.

Não executa: limpeza do chão (separada, 60 min), exclusão de personagem, cancelamento de hunt, reset de instância, remoção de recompensas ou de registros de recuperação. **Não há desconexão**, então nenhuma mensagem fala em interrupção.

Reiniciar o servidor **não** dispara save e **não** recupera ciclo perdido; ciclos que ficaram `executando` viram `interrompido` na subida.

## 3. Operação
- **Ativar:** já liga no boot (`backend/index.mjs`). `SERVER_SAVE_ENABLED=false` desliga.
- **Manual (administrador):** `POST /api/mapas/_conteudo/server-save` com `{"acao":"executar"}` (mesmo prefixo trancado do editor: só por túnel SSH). `GET` mostra situação e últimos ciclos.
- **Modo de manutenção** (`modo-de-manutencao.mjs`, desligado): `MAINTENANCE_MODE=true` ou `{"acao":"manutencao","ativo":true}` bloqueia só ENTRADAS novas; `drenar` grava e solta as sessões pelo caminho de sempre. As hunts offline seguem. Nunca é ligado pelo save diário.
- **Desligar o servidor:** o SIGTERM grava os jogadores (`soltarPersonagem` carimba `offlineDesde`); na subida a consolidação e o login retomam do estado gravado, sem duplicar.
- **Rollback:** `SERVER_SAVE_ENABLED=false` e reiniciar; ou reverter o commit. A tabela `server_save_ciclos` pode ficar (é só registro).

## 4. Backup
`scripts/backup-postgres.sh` agora grava em arquivo parcial, **valida** (gzip íntegro + tabela `personagens` presente) antes de aceitar, e a rotação só roda depois do novo validado, sempre mantendo os 3 mais recentes. `scripts/testar-restauracao.sh` restaura o último backup num banco temporário isolado do container e confere os personagens (nunca no de produção). O diário continua sendo agendado por cron/timer no host (ver `docs/deploy.md`); o `personagens` já carrega o estado do farm e `creditos` as recompensas pendentes.
