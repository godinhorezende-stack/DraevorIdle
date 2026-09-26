# Protocolo do Ravox Idle

Lido estaticamente do código-fonte do cliente (`assets_raw/client/src/*.mjs`), que veio
**inteiro e não-minificado**, com comentários originais em português. Nada aqui foi
observado em tráfego de rede — é o que o cliente sabe mandar e sabe tratar.

Transporte: um único `WebSocket` em `wss://ravoxidle.com.br/ws` (ou `ws://` sem TLS),
aberto em `main.mjs`. Toda mensagem, em ambas as direções, é um JSON com um campo `t`
identificando o tipo (`socket.send(JSON.stringify({ t: '...', ...campos }))`).

Não há REST além do handshake HTTP normal de servir os arquivos estáticos — login,
personagens, ações de jogo, loja, mercado etc. tudo passa pelo mesmo socket.

## Cliente → servidor (121 comandos)

Extraído de `send({ t: '...' , ... })` em todos os módulos. Ver cada arquivo para os
campos extras de cada comando (ex.: `auth.mjs:574` para `login`, `panels.mjs:9064` para
`market`).

```
actionPreset       actions            aljava             aljavaGuardar
ammo               arvore             autoBoss           bank
bless              blessings          bossPouch          bossToken
caixa              charms             chat               clearBackpack
clearPouch         coinMarket         contaChar          craft
craftFazer         createCharacter    deixarOffline      deleteCharacter
delta              depot              destroy            diario
diarioEscolher     distance           entrarNaArena      entrega
equip              esqueciSenha       falarComNpc        favorita
forja              forjaAfixoFundir   forjaAfixoPrevia   forjaAfixoPreviaFundir
forjaAfixoPreviaInserir            forjaAfixoPreviaRetirar   forjaAfixoReroll
forjaAfixos        forjaSubir         forjaTransferir    friends
gemas              google             grupo              historicoDaLoja
huntAction         huntAssist         huntEscada         huntTarget
huntVirar          huntWalk           huntWalkTo         imbue
imbuements         itemRule           joias              juntar
largar             limites            lite               lobby
login              logout             lootFiltro         lootPreset
lure               marco              market             mount
mounts             oculta             organizar          outfit
party              pedirMapa          pegar              perfil
play               pouch              presenca           presente
prey               proficiency        promote            ranking
release            report             resetAnalyzer      resume
reward             settings           split              stopHunt
store              storeInbox         strategy           taskToken
tasksDeBicho       tfaComecar         tfaConfirmar       tfaDeNovo
tfaDesligar        tfaLigar           tierUp             trade
training           transfer           trocar             unequip
usar               venderSacolas      virar              vocation
walk               walkTo
```

## Servidor → cliente (66 eventos)

Extraído dos `switch`/`case` que tratam `message.t` recebido do socket (principalmente
em `main.mjs`, com sub-despachos em `chat.mjs`, `panels.mjs`, `inventory.mjs` etc.).

```
actionCatalog      andamento          arena              arvore
audio              blessings          bossPouch          bossToken
charms             chat               coinMarket         compraNoDeposito
contaCharDados     craft              death              diarioAtualizado
diarioEscolha      donate             error              escolherCaixa
events             forja              forjaAfixoPrevia   forjaAfixoPreviaFundir
forjaAfixoPreviaInserir  forjaAfixoPreviaRetirar  forjaAfixos        friends
grupoConvite       hello              historicoDaLoja    marcoNoDeposito
market             marketDetail       marketHistorico    marketOffers
mounts             npc                npcFala            online
partyInvite        pedidoDeEntrada    perfil             pong
premio             presenca           proficiency        quase
ranking            released           reportOk           reportResposta
runReport          serversave         shop               state
store              taskToken          tasksDeBicho       treinoReport
trocaTc            venderMochila      venderSacolas      victory
welcome
```

`state` é o de longe mais importante: chega ~4x por segundo com o `delta` do mapa
(criaturas, jogadores, HP, posição) — é o que `pedirMapa`/`delta` (client→server) liga.
`events` carrega o que não pode esperar o próximo `state` (balão de fala do canal
Local, por exemplo — ver comentário em `main.mjs` por volta da linha 934).

## Handshake observado (`main.mjs`)

1. `socket = new WebSocket(...)`, `onopen` →
   `send({ t: 'delta', on: true, sessao: true, fundo: true })` e
   `send({ t: 'jaTenhoCatalogo' })` (este último não está na lista acima — closure
   fora do padrão `send({t:...})`, revisar se for reimplementar o handshake).
2. Servidor responde com `hello`/`welcome` conforme o estado da conta (ver `auth.mjs`).
3. Login por e-mail/senha: `login`. Por Google: `google`. 2FA: `tfaConfirmar`.
4. Escolha/criação de personagem: `contaChar`/`createCharacter`/`play`.
5. Em jogo: `walk`/`walkTo`/`huntWalk` para movimento, `huntTarget`/`huntAction` para
   combate automático, `state` chegando continuamente do servidor.

## O que falta para fechar o protocolo

Isto é leitura estática do cliente — dá o **nome** de cada comando/evento e onde cada
um é montado/consumido, mas não os formatos exatos de payload em produção nem a ordem
de alguns fluxos (ex.: o que exatamente vem dentro de `state.events`, os campos de
`market`/`coinMarket`, o formato de `forja*`). Para isso não tem substituto: logar o
JSON de cada mensagem enquanto o próprio dono joga é o próximo passo (basta um
`socket.addEventListener('message', e => console.log(e.data))` no DevTools, ou um proxy
local no `/ws`). `window.__ws` já está exposto pelo próprio cliente (`main.mjs:5308`)
para inspeção via console.
