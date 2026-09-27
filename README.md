# Draevor Idle — restauração

Recuperação do jogo depois da perda de acesso administrativo à VPS que o hospedava.

**Importante, e diferente do caso do Poke Idle**: `ravoxidle.com.br` **ainda estava no
ar** (processo original rodando sem supervisão, podendo cair a qualquer momento) na
última vez que isto foi verificado, em 2026-09-22. Isso mudou o método pela metade do
caminho: em vez de só ler o cliente estático e adivinhar o formato de cada payload, foi
possível logar com uma conta de teste e capturar ao vivo o mapa real da cidade, o
catálogo real de itens (com nome) e o equipamento real de cada vocação — ver "O que foi
capturado AO VIVO", abaixo. Se o site ainda responder, sempre vale capturar mais antes de
reescrever mais um sistema no chute.

## O que tem aqui

| pasta | o que é | origem |
|---|---|---|
| `game/frontend/client/src/` | 18 módulos do cliente (`main.mjs`, `panels.mjs`, `inventory.mjs`, ...) | **baixado**, não-minificado |
| `game/engine/` | 9 módulos compartilhados (fórmulas, cor de outfit, prazos...) | **baixado**, não-minificado |
| `game/frontend/client/assets/` | ícones e arte de UI (37 arquivos) | **baixado** |
| `game/gamedata/` | índices (`outfits.json`, `item-sprites.json`, `effect-sprites.json`, `missile-sprites.json`) + atlas de sprite | **baixado** |
| `api-mapeada/protocolo.md` | comandos/eventos do WebSocket, lidos do cliente | escrito a partir da leitura do código |
| `api-mapeada/checklist-modulos.md` | os 21 ícones da barra + ~13 sistemas extras, um a um: o que cada um abre, quais comandos usa, e o estado real testado ao vivo | escrito e testado nesta revisão |
| `tools/` | os dois crawlers usados na recuperação | escrito do zero |

O cliente veio **inteiro e legível** — o site serve o fonte sem minificar, com
comentários originais em português (inclusive relatos do próprio dono sobre bugs em
produção). Nada dele foi reescrito.

## O que foi recuperado exatamente

- **1.409 arquivos, ~266 MB** de assets (rodar `tools/baixar.py` e depois
  `tools/baixar2.py` reproduz o mesmo conjunto)
- **1.306 outfits/criaturas** com atlas de sprite completo (`gamedata/sprites/outfits/`)
- **4.343 itens** com sprite, em 10 páginas de atlas (`items32-`, `items64-`,
  `draevor32-`, `tier32-`, `boost32-`, `extra32-/64-`, `pouches32-`)
- **232 efeitos** e **56 projéteis**, com todas as páginas de atlas
- **O protocolo do WebSocket**: 121 comandos cliente→servidor e 66 eventos
  servidor→cliente, com onde cada um é montado/tratado no cliente — ver
  `api-mapeada/protocolo.md`
- HTML das páginas públicas (`/`, `/jogar`, `/online`, `/streamers`) e CSS

Não há trilha de áudio/efeito sonoro no cliente (o único uso de `Audio` é
texto-para-voz do chat) — o jogo aparentemente não tem música/SFX, então não falta
nada nesse ponto.

## O que foi capturado AO VIVO (não é chute — é o dado real)

Com o backend original ainda respondendo, logar com uma conta de teste (nunca com a
conta pessoal do dono — ver nota de privacidade no fim desta seção) e ler o tráfego real
do WebSocket trouxe dados que a extração do cliente estático nunca poderia dar, porque
eles só existem do lado do servidor:

| arquivo | o que é | tamanho |
|---|---|---|
| `game/gamedata/city-map.json` | **o mapa real da cidade**: 187×108 tiles, 9 andares, paleta+pilhas+colisão | 3,7 MB |
| `game/gamedata/sprites/city.png` | o atlas real da cidade (o `map.atlas` do arquivo acima) | 9,5 MB |
| `game/gamedata/city-meta.json` / `api-mapeada/city-meta.json` | NPCs reais (Banker, Zuma Magehide), bonecos de treino, itens largados no spawn, posição de nascimento real (`x:99,y:65,z:7`) | 15 KB |
| `game/gamedata/item-catalog.json` | **catálogo real de 6.178 itens** — nome, peso, raridade, chance de drop, tipo | 1,3 MB |
| `game/gamedata/equipamento-por-vocacao.json` / `api-mapeada/equipamento-real-por-vocacao.json` | o equipamento real com que cada uma das 5 vocações nasce (peça por peça) | — |
| `api-mapeada/character-real-example.json` | um personagem real completo (96 campos) — a referência para todo campo que faltar | 88 KB |
| `api-mapeada/welcome-extras.json` | ranking real (top 25) e o changelog (`novidades`) do momento da captura | — |

Isto **substitui** a praça-placeholder e o `statsBase` chutado das revisões anteriores.
`game/engine/formulas.mjs` (já extraído do cliente, sem precisar de captura ao
vivo) tem as fórmulas exatas de vida/mana/velocidade/capacidade por level — testadas
contra os 5 personagens reais capturados e conferem em TODOS: knight 255 HP / 70 mana no
level 8, paladin 220/140, druid e sorcerer 185/245, monk 241/105. Zero chute nessas
contas agora.

**Nota de privacidade**: nenhuma captura tocou a conta real do dono. Foi criada uma
conta de teste (`claude-restore-test-9182@…`), 5 personagens (um por vocação) foram
feitos, jogados uma vez para capturar o `welcome`, e depois apagados do servidor ao
vivo — o `api-mapeada/character-real-example.json` é desse personagem de teste, não do
personagem pessoal do dono.

## O que NÃO pode vir da extração nem da captura (ficou perdido, ou não foi capturado ainda)

- Contas, senhas, personagens, itens, saldo, histórico **da conta pessoal do dono** —
  esses continuam só no processo original, que responde mas não tem painel de
  admin/backup acessível
- A lógica de servidor de cada sistema (combate, hunts, loja, mercado, forja, árvore de
  talentos, blessings, charms, imbuements, prey, tasks, bosses, guildas/party) —
  **regras**, escritas do lado que não é servido ao navegador. Isto poderia, em
  princípio, ser capturado por amostragem (jogar uma hunt de teste e logar o
  `state.hunt`), mas ainda não foi feito — ver "Próximos passos"
- Autenticação real (hash de senha, 2FA, OAuth Google), envio de e-mail, qualquer
  integração de pagamento

## O núcleo do servidor (`game/`)

Escrito do zero, mesmo esqueleto do `pokeidle-restore/server/`: `node:sqlite` nativo
(Node 22+), `ws` para o WebSocket, um gateway HTTP que serve `game/frontend/` como
cliente. Reorganizado em `game/{backend,engine,database,websocket,systems,admin,
frontend,gamedata,docker}` — ver `docs/refatoracao-estrutura.md` para o porquê de
cada pasta e o mapeamento completo.

```bash
npm install
npm run dev   # node game/backend/index.mjs -> http://localhost:8080/jogar
```

Banco: SQLite por padrão (nada para instalar); com `DATABASE_URL=postgres://...`
no ambiente, o mesmo servidor fala com PostgreSQL — ver `docs/auditoria-performance.md`
(Fase 6) e, para subir tudo com Docker Compose (nginx + game + postgres),
`docs/deploy.md`.

| arquivo | o que faz |
|---|---|
| `game/backend/index.mjs` | gateway: serve o cliente por HTTP, abre o WebSocket em `/ws` |
| `game/database/banco.mjs` | contas (scrypt), sessões, personagens — SQLite ou Postgres, por `DATABASE_URL` |
| `game/systems/regras.mjs` | constantes — looks por vocação, level inicial 8, fórmulas REAIS de vida/mana/velocidade/capacidade (importadas de `game/engine/formulas.mjs`) |
| `game/systems/dados.mjs` | carrega os arquivos capturados (mapa, catálogo, molde de personagem, equipamento) — só leitura de disco, nenhuma regra |
| `game/websocket/sessao.mjs` | camada de REDE só: uma conexão = uma `Sessao`, despacha comando→método, traduz resultado de `game/systems/*` em mensagem WebSocket |
| `game/systems/inventario.mjs` | domínio do inventário: equipar de início, peso, destruir, largar/pegar do chão (chão compartilhado, semeado com os itens reais do spawn) |
| `game/systems/recompensas.mjs` | domínio das recompensas: presente de level (arma de treino/set/montaria/outfit) e calendário diário, com cooldown real |

**Funciona hoje**: `register`/`login`/`resume` por e-mail+senha, lista e criação de
personagem (as 5 vocações, com o outfit, o HP/mana, a capacidade e o **equipamento
inicial REAIS** — tudo capturado ao vivo, ver seção acima), excluir personagem
(`deleteCharacter` — confirmação por senha, avisa a outra aba se o personagem excluído
estava em jogo nela), entrar no personagem (`welcome`, que também manda o catálogo real
de itens) e andar/virar pela **cidade real** (`walk`/`virar` com `{dx,dy}` contínuo — não
é um passo por mensagem, é o rumo que o WASD segurado aponta; o servidor decide o ritmo
do passo, 250ms, igual ao original) com **colisão real** contra `city-map.json`'s
`blocked` (não dá mais para atravessar parede). O mapa completo só viaja no `welcome` e
em resposta a um `pedirMapa` — mandar os 3,7MB dele em todo tique de 100ms seria 37MB/s
por jogador.

Verificado no navegador ponta a ponta, incluindo lado a lado com uma captura de tela do
jogo original no mesmo lugar: cadastro → criar personagem (as 5 vocações) → entrar no
mundo (a praça real, com os NPCs reais Banker/Zuma Magehide e os bonecos de treino) →
andar com colisão → virar → excluir personagem → voltar pra lista, sem erro no console.
Uma queda seca de conexão (rede, aba fechada à força) não derruba mais o servidor para
todo mundo — `ws`/`wss`/`http` tinham `error` sem listener, que em Node é exceção fatal
do processo.

**Todos os 21 ícones da barra e mais ~13 sistemas foram testados um a um** ao vivo — ver
`api-mapeada/checklist-modulos.md`. Duas causas-raiz explicavam quase todo crash:
o `catalog` do `hello` só tinha 3 campos (o cliente lê ~25), e o `character` só tinha
~15 (o cliente lê ~90). A segunda foi resolvida usando um **personagem real capturado
ao vivo** como molde — `characterParaCliente` espalha esse personagem de teste por baixo
e só sobrescreve os campos que este servidor calcula de verdade. Resultado: Ficha do
Personagem, Prey, Hunts, Imbuements, Cyclopedia (os 6.178 itens reais, com nome e preço,
busca e filtro funcionando), Quests, Amigos, Highscores, Party, Analisador, Banco e
Depósito abrem **sem erro nenhum no console**, com dado real ou estado vazio correto.

**Ações de item também funcionam de ponta a ponta**: largar no chão, destruir na
lixeira e pegar do chão (`largar`/`destroy`/`pegar`) — o chão é compartilhado (um `Map`
em `game/systems/inventario.mjs`), semeado no boot com os itens reais que estavam largados
no spawn quando a cidade foi capturada. Presente de level e recompensa diária também
(`presente`/`marco`/`diario`/`diarioEscolher`), com cooldown real de 20h entre coletas
— não existia nenhum, e dava para coletar a recompensa diária infinitas vezes (achado
pelo dono).

**Ainda não existe**: nenhum sistema de JOGO em si (combate, hunts, loja, mercado, forja,
árvore de talentos, prey, gemas, charms) — a UI de cada um já abre (ver checklist), mas
fica em "carregando..." porque o comando que ela manda (`forja`, `arvore`, `gemas`,
`charms`, `store`, `market`, `tasksDeBicho`, ...) ainda não tem handler no servidor. O
personagem entra, anda pela cidade real, abre todo painel — e é só. Outros andares da
cidade (ela tem 9) e os mapas de hunt continuam sem captura.

### Próximos passos, em ordem de custo/benefício

1. **Se o site ainda responder**: capturar pelo menos UM mapa de hunt em nível baixo
   (o personagem de teste nasce level 8) do mesmo jeito que a cidade foi capturada —
   entrar numa hunt, deixar o `state.hunt` chegar, salvar. Isso desbloqueia testar
   combate contra um mapa real em vez de inventado.
2. Sistema de combate básico: um monstro parado, dano de arma, morte, respawn. Sem isso
   nenhum outro sistema (loot, XP, tasks, bosses) tem com o que trabalhar.
3. Loja/mercado — o catálogo de itens já existe (`item-catalog.json`), falta a lógica de
   comprar/vender.
4. O resto, na mesma ordem que `pokeidle-restore/server/sistemas/` seguiu.

### Descobrindo o formato exato de cada payload

`api-mapeada/protocolo.md` lista o **nome** de cada comando/evento e onde ele aparece no
cliente, mas não o formato exato de payload em produção. O jeito de descobrir sem
adivinhar, na ordem que funcionou aqui:

1. Rodar o servidor local e abrir `/jogar` num navegador de verdade.
2. Ler o código do cliente na função que TRATA o campo que falta (ex.: procurar
   `character.equipamento` ou `progress.percent`) — ele já diz exatamente o shape
   esperado.
3. Quando o cliente lança `TypeError: Cannot read properties of undefined (reading
   'x')`, é sempre um campo que falta no objeto que o servidor mandou — o nome do campo
   está no próprio erro.
4. `window.__ws` fica exposto pelo cliente (`main.mjs`) — dá para mandar comandos direto
   do console/DevTools sem depender de clique ou teclado, o que também serve para testar
   automação: **um navegador automatizado que simula tecla pode não focar a página**, e
   nesse caso `window.__ws.send(JSON.stringify({t:'walk', dx:1, dy:0}))` confirma se o
   problema é no clique/tecla ou no protocolo.

### Ícones dinâmicos que o crawler do passo 1 não pegou

O crawler (`tools/baixar.py`) só acha caminho **literal** em `src`/`href`/`import`. Um
ícone montado por template string (`` `/client/assets/ui/tb-${id}.png` ``, em
`main.mjs`) nunca aparece como string completa no código-fonte, então passa batido.
`tools/baixar3.py` tenta uma lista fechada de nomes candidatos (os ids de cada botão da
barra, `sk-<skill>`, `el-<elemento>`) contra `icons/` e `ui/` do site vivo e guarda só o
que responde 200 — achou mais 70 ícones. Se aparecer outro 404 de ícone faltando, é o
mesmo padrão: achar QUEM pede aquele nome no cliente e de onde ele tira o `id`.

## Nota

Este jogo usa sprites extraídos do client do Tibia (ver comentário no topo de
`game/frontend/client/src/sprites.mjs`) — a arte original é IP da CipSoft, independente de
quem opere o site. Isso vale para publicação, não para este backup local de um projeto
próprio.
