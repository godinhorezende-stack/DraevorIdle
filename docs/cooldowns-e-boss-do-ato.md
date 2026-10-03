# Cooldowns do Draevor e o novo fluxo do boss de fim de ato

## 1. A origem do "40 horas"
Não existe 40 h em código nem em dados. A recarga vinha de `cooldownHours`, do catálogo capturado do jogo original (`gamedata/catalog-real.json`, 87 bosses): **12 h** para os bosses dos Atos 1 a 3 e **72 h** para o do Ato 4 (The Primal Menace). A regra: `Bosses.marcarEntrada` grava `bossCooldownsAte[boss] = agora + cooldownHours` **na ENTRADA** (mesmo que o boss não caia) e `Cacadas.entrar` recusa ("ainda não voltou: faltam ~Nh") — só depois da primeira vitória do ato (a primeira vez era livre). Em produção (consulta somente leitura em 03/10) havia carimbos de até **37,9 h restantes** no The Primal Menace e de até 10,5 h no Urmahlullu (boss do Ato 1): é o "~40 h" que aparecia.

## 2. Auditoria dos cooldowns (valores e onde moram)
| Sistema | Valor atual | Onde | Comportamento esperado | Situação |
|---|---|---|---|---|
| Boss final do Ato 1 (Urmahlullu) | 12 h, da 2ª entrada em diante | catálogo + `cacadas.mjs entrar` + `bosses.mjs marcarEntrada` | sem recarga | **Corrigido** |
| Bosses finais dos Atos 2 e 3 (Ascending Ferumbras, Bakragore) | 12 h | idem | sem recarga | **Corrigido** |
| Boss final do Ato 4 (The Primal Menace) | 72 h | idem | sem recarga | **Corrigido** |
| Demais bosses (80 de 12 h, 4 de 20 h, Thor 24 h, Ferumbras Mortal Shell 48 h) | `cooldownHours` | catálogo | recarga própria de cada boss | Preservado |
| Boss de task | sem recarga; uma vez por personagem | `bosses.mjs recusaDaTask` | idem | Preservado |
| Sala do boss | 25 min lá dentro | `bosses.mjs TEMPO_NA_SALA_MS` | limite do combate, não da entrada | Preservado |
| Auto Boss | leva de 15 entradas, depois 6 h de espera (o passe tira) | `bosses.mjs auto` | proteção do farm automático | Preservado (ver 6) |
| Magias / runas | 1 s a 600 s (109 magias, 18 runas); GCD 2 s; poção 1 s | `action-catalog.json`, `regras.mjs`, `acoes.mjs` | regras de combate | Preservado |
| Respawn de criaturas comuns | 30 s; fases da campanha (instância) não renascem | `hunt/monstros.mjs RESPAWN_MS` | idem | Preservado |
| Acesso Instance/Divine | 24 h por porta | `premium.mjs ACESSO_MS` | produto premium | Preservado |
| Prey (nova lista grátis) | 20 h por slot | `prey.mjs` | idem | Preservado |
| Presente diário | 20 h | `regras.mjs INTERVALO_DIARIO_MS` | idem | Preservado |
| Treino (tanque), stamina, loja diária, arena (semana), chat (1 s / mercado 30 s) | vários | `treinos.mjs`, `stamina.mjs`, `loja.mjs`, `arena.mjs`, `chat.mjs` | idem | Preservado |
| Portais | não existia portal | — | sem bloqueio | **Novo** (sem recarga) |
| Cronômetro no cliente | `bossCooldowns` (de `bossCooldownsAte`) e texto "A espera de Nh..." | `main.mjs contarOsPrazos`, `panels.mjs askBoss` | sem cronômetro para boss de ato | **Corrigido** |

## 3. O que mudou
- **Catálogo**: os 4 bosses de ato saem com `cooldownHours: 0` e `semEspera: true` (`campanha.mjs`, no boot; o catálogo vai ao cliente). O servidor ainda ignora recarga desses bosses em três lugares (`entrar`, `marcarEntrada`, Auto Boss): o catálogo é o aviso, o servidor é a regra.
- **Migração sem operação destrutiva**: no login, `Bosses.limparRecargasDeAto` zera só o **carimbo** da recarga dos bosses de ato (progresso, vitórias e sacolas não são tocados). Sem ele a entrada já passaria, e o relógio some da tela. Nenhum UPDATE em lote no banco.
- **Portal**: ao concluir a **última fase jogável do ato** com o ato todo completo (`Campanha.bossLiberado`), a sala abre o portal (`hunt.portalDoBoss`: boss do ato, ato, dificuldade, posição). Idempotente (não duplica), sobrevive à instância nova da mesma fase e à gravação do personagem. Voltando à última fase já completa, o portal já nasce na entrada (tentar de novo sem refazer o ato). Marcador roxo no mapa (clicável) + botão "Portal aberto — enfrentar <boss>" também na Caça Automática + aviso "Hunt Clear!".
- **Entrada** (`{t:'portalDoBoss'}`, ou `interagir` no marcador): o servidor confere que a fase é a última do ato, que o portal existe na sala e que o boss está liberado **para quem pede**; só então entra na arena (a mesma arena de boss de sempre, sem os bichos da fase), sem gravar espera. Pedido repetido não faz nada (a hunt já é a do boss).
- **Vitória**: `vitoriaNoBoss` passou a ser idempotente por luta (evento de morte repetido não paga outra sacola nem outra conclusão). Cada luta nova paga a sua sacola (farm) e o ato conta como concluído uma vez.
- **Party**: o portal mora na sala do dono; cada integrante vê e entra **por conta própria**, só se ele tem o ato liberado; quem não tem não vê o botão. Ninguém é levado junto (quem marcou "Seguir líder" vai pelo caminho de sempre). Morte/queda de um integrante não mexe nos outros.

## 4. Testes
`boss-do-ato.test.mjs` (13): catálogo, recarga antiga (72 h/12 h) não bloqueia e boss comum segue bloqueado, 10 entradas seguidas sem espera, boss fechado sem as fases, portal não aparece antes de concluir, abre ao concluir (uma vez, com aviso e marcador), sobrevive a instância nova e gravação, entrada na arena + pedido repetido, morrer e voltar 5 vezes, só abre na última fase e não confia no cliente, party (cada um por conta própria), vitória idempotente, e o cliente (botão, marcador, texto sem espera).

## 5. O ciclo do primeiro ato
Fases 1–12 do Fácil → Hunt Clear da 12ª (Putrid Mummies) → portal aberto → arena do Urmahlullu → vitória (libera o Ato 2 uma vez) → de volta à fase → portal de novo → nova luta, sem espera.

## 6. Limitações e pontos de decisão
- **Sala do boss de 25 min** continua (limite de duração do combate, não de entrada).
- **Auto Boss**: se um boss de ato estiver numa sequência, a leva de 15 entradas (e os 6 h) valem para o Auto Boss como um todo. Não mexi: é a proteção do farm automático, outra regra.
- **Pela lista de bosses** (sem a campanha) o boss de ato também entra sem recarga, mas com a força original e exigindo o level dele; a força da dificuldade vem só pela campanha/portal.
- **O boss final no "editor de atos"**: ele é configurado em `gamedata/campanha.json` (`bosses[ato].bossId`); o `editor-conteudo` hoje não edita esse arquivo (os atos dele cuidam de outro conteúdo). Não adicionei seleção no editor.
- **Reinício do servidor durante a luta**: a luta é uma hunt gravada como as outras; não testei um reinício real, e o portal (que vive na hunt da fase) é gravado. Reconexão: o portal e o botão voltam no primeiro retrato.
- A arena é a infraestrutura de boss de sempre (uma sala por entrada); grupos diferentes não compartilham estado de combate.
