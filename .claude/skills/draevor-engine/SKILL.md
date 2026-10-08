---
name: draevor-engine
description: Como trabalhar com o motor de runtime do Draevor — relógio e tique (250 ms em fatias), sessão, estado do personagem e da caçada (hunt), instâncias, terreno/grade, caminho e movimento, colisão na grade, andares, monstros, eventos e quadro (delta) para o cliente, timers (clock lógico, recargas), ciclo de vida (entrar, sala/party, sair, morrer, offline), threads e persistência. Use ao mexer em tique, movimento, instância, mapa, sala de party, worker, autosave ou quadro — e para decidir se algo é motor (técnico) ou regra de gameplay (vai para systems/skills poe-*).
---

# Draevor — o motor de runtime

**Regra:** não reescreva o motor sem evidência medida de necessidade. Procure o que já existe, reutilize, meça o impacto e mantenha
compatibilidade com o estado salvo (personagens e caçadas gravados no banco). Regra de gameplay (dano, drop, XP, gema, item, ato) não
entra no motor: vai para `game/systems/**` (ver `draevor-architecture`).

Base técnica medida: `docs/auditoria-performance.md` (§2 mapa, §4 game loop, §6 WebSocket, §7 entidades).

## Onde está o motor (não é a pasta `game/engine/`)

| Peça | Arquivo | O que faz |
|---|---|---|
| Relógio global | `game/websocket/sessao.mjs` (`FATIAS = 5`, `ligarRelogio`, `Sessao.tique`) | um relógio para todos; cada sessão numa fatia fixa; 250 ms por sessão |
| Passo do jogo | `game/systems/regras.mjs` (`PASSO_MS = 250`) | um passo de grade por `PASSO_MS` |
| Tique da caçada | `game/systems/cacadas.mjs` (`tique(estado, personagem, agora)`) | puro sobre `estado`; devolve a lista de **eventos** |
| Golpe básico e mortes | `game/systems/hunt/combate.mjs` (`round`, `processarMortes`, `matarMonstro`) | chamado pelo tique |
| Instância | `game/systems/hunt/instancia.mjs` (`comporBichos`, `marcarSeLimpou`, `progresso`, `pendentes`) + `gamedata/instancias.json` | cada entrada cria uma; "Hunt Clear!" → nova |
| Terreno e grade | `game/systems/hunt/terreno.mjs` (`acharHunt`, `huntOuMapaCustom`, apelido de mapa) | grade andável; as áreas do PoE usam o terreno das hunts do Draevor |
| Caminho, alvo, percurso | `game/systems/hunt/{caminho,alvo,percurso,rotas,progresso,lure}.mjs` | busca na grade, trava de alvo, laço da Caça Automática |
| Andares e setores | `game/systems/hunt/{andares,setores}.mjs` | escadas; setores derivados do mapa |
| Monstros | `game/systems/hunt/monstros.mjs` (`criarMonstro`, `garantirUidAcimaDe`) | nascer, renascer, perseguir, trocar de andar |
| Sala da party | `game/systems/hunt/{sala,aliados,escalonamento}.mjs`, `game/systems/party.mjs` | o DONO da sala move os bichos; convidados leem dela |
| Quadro para o cliente | `game/websocket/quadro.mjs` | só o que está na tela e só o que mudou |
| Limites de mensagem | `game/websocket/limites.mjs` | taxa e tamanho |
| Persistência da caçada | `cacadas.mjs` `huntParaGravar` / `huntAoCarregar`; `database/caca-offline.mjs` (colunas `caca_offline_*`) | caçada compacta no `estado` |
| Autosave e Server Save | `Sessao.gravarAgora`, `game/systems/server-save.mjs` | grava sem parar o jogo |
| Offline | `game/systems/simulacao-offline.mjs` + `game/systems/simulacao-offline-worker.mjs`; `cacadas.mjs` `simularAusencia`/`consolidarAusencia`/`projetar`; `game/systems/consolidacao-offline.mjs` | 30 min tique a tique, o resto projetado |
| Threads do tique (desligadas) | `game/systems/simulador-tique.mjs` + `game/systems/simulador-tique-worker.mjs` (`SIMULADORES_TIQUE`) | só hunt solo |
| Hot reload de conteúdo (local) | `game/systems/hot-reload.mjs` | a Engine grava, o jogo local recarrega |

## O tique, na ordem

`Sessao.tique` (a cada 250 ms por sessão): invalida a ficha (`Ficha.invalidar`) → autosave se passou do intervalo → monta o contexto
não persistido da caçada (party, pódio — `Object.defineProperty` não enumerável, fora do save) → `Cacadas.tique` (ou o worker) → morte
→ `mandarEstado(false, eventos)` (quadro).

`Cacadas.tique`: fim de sala/boss/premium → relógio (`hunt.clock += passou`, `hunt.relogioAnterior`) → consumo por tempo (stamina,
boosts, prey) → efeitos por tempo do PoE (`itens-poe/mods-poe.mjs` `tique`, auras) → **só o dono da sala**: instância (limpou?),
renascimento, escalonamento → grade do andar → movimento (`passosDoTique`, caminho/percurso/alvo) → combate (`round`, combo da barra,
golpes dos monstros) → mortes → eventos.

## Estado e tempo

- **`estado`** = o personagem inteiro (JSON no banco). **`estado.hunt`** = a caçada (bichos, posição, instância, relógio). Campo novo
  na caçada: decida se vai para o banco (`huntParaGravar`) ou é derivado; derivado vai como propriedade não enumerável.
- **Relógio lógico:** use `hunt.clock` (avança só caçando) para recargas, durações e buffs da caçada; `Date.now()` só para coisas de
  parede (premium, cooldown de boss em horas, ausência). Recargas usam `R.jaPode(agora, proximoEm)`.
- **Determinismo:** sorteios usam `Math.random`; testes e simuladores injetam `rng` (semente `mulberry32`). Não acople sorte a ordem de
  iteração de `Map`/`Set` sem necessidade.
- **Party:** a sala é um objeto vivo compartilhado (`hunt.anfitriao`, `hunt.partilha`) — por isso hunt em grupo nunca roda em worker.

## Ciclo de vida

Entrar (`Cacadas.entrar` — no jogo oficial só conteúdo do PoE, `conteudoDoJogoOficial`) → caçar (online/automático) → sair
(`Cacadas.sair`) ou morrer (`morrerNaHunt` na sessão, `systems/morte.mjs`) → cidade (no PoE a cidade enche vida/mana/frascos:
`encherNaCidade`) → aba fechada: a caçada segue OFFLINE (`hunt.offlineDesde`, consolidação a cada 10 min) → login: simula a ausência.

## Antes de criar infraestrutura nova

1. Já existe? (tabela acima; `docs/auditoria-performance.md`).
2. Funciona em **todos** os processos que rodam o jogo? Servidor, `simulacao-offline-worker`, `simulador-tique-worker`,
   `admin/validacao-runner` e testes — todos carregam o jogo por `iniciarJogoDoPoe()`; worker novo também tem de chamar.
3. O estado salvo continua carregando (personagens antigos, caçadas gravadas)? Escreva a conversão em `huntAoCarregar`, não quebre.
4. Custo por tique: o laço roda para todo mundo a cada 250 ms — nada de varrer o catálogo inteiro ou ler disco no tique.
5. A regra é técnica (fica aqui) ou de gameplay (vai para systems, skills `poe-*`)?

## Armadilhas conhecidas

- `ModsPoe.tique`/auras e o combate do PoE são chamados de dentro do tique: regra do PoE no caminho quente — não espalhe mais.
- Ler no topo do módulo um valor de outro módulo do ciclo grande quebra por TDZ (ver `draevor-architecture`).
- `game/engine/` é isomórfico (o cliente importa): não coloque `node:fs` nem estado de servidor lá.

## Testes

Sessão de teste sem relógio: `new Sessao({ readyState: 1, send })` e `await s.tique()` à mão; caçada pura com `Cacadas.tique(estado,
PERSONAGEM, agora)` avançando `agora` de `PASSO_MS`. Ver `draevor-testing`.
