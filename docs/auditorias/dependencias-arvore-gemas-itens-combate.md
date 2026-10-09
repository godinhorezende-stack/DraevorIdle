# Dependências: árvore × gemas × itens × combate

O mapa de como a árvore de passivas, as gemas, os itens e o combate se ligam no código real do Draevor (modo PoE, `ITENS_POE=1`), e o
que falta em cada ligação. Ciclo 1 desta auditoria: 09/10/2026.

- **Grafo gerado** (categoria → nós → linhas → atributos → arquivos consumidores → gemas): [`dependencias-arvore-gemas-itens-combate-grafo.md`](dependencias-arvore-gemas-itens-combate-grafo.md), por `game/tools/mapear-dependencias.mjs`.
- **Inventário por nó** (a escada exibido → alocável → interpretado → aplicado → validado): [`arvore-passivas-poe-inventario.md`](arvore-passivas-poe-inventario.md).
- **Auditoria da árvore** (lacunas, correções, keystones): [`arvore-passivas-poe.md`](arvore-passivas-poe.md).

---

## 1. Os sistemas e as ligações (o que existe)

Cada linha foi conferida no código.

| # | Sistema | Onde mora | Recebe de | Entrega para | Situação |
|---|---|---|---|---|---|
| 1 | Árvore de passivas | `systems/passivas/arvore.mjs` (motor), `passivas/comandos.mjs` (pedido), `itens-poe/arvore.mjs` (tradução das linhas), `gamedata/itens-poe/arvore-poe.json` | sessão (WebSocket) | soma de atributos (`Afixos.soma` ← `Passivas.efeitos().adds`); `Especializacoes.efeitos` (vida/mana/precisão %); keystones (`Keystones.aplicarNaFicha`, `temHabilidade`) | completo no motor (alocação, pontos, respec, maestrias, escolhas, inícios extras); efeitos pelo sistema de mods |
| 2 | Gemas ativas | `itens-poe/gemas-poe.mjs` (registro, níveis, partes do golpe, degenerativo, buffs), `itens-poe/compilador-de-gemas/` (arquétipos), `skills/gemas.mjs` (encaixe), `acoes.mjs` (uso) | itens (encaixe), ficha | combate (acerto, afecções, dano contínuo), lacaios/totens, buffs | 562 gemas; 93 (17%) funcionam inteiras, 450 em parte, 19 sem comportamento; o comum que falta são linhas específicas da gema ("efeito não simulado") |
| 3 | Gemas de suporte | `itens-poe/suportes-poe.mjs`, `itens-poe/compat-suportes.mjs`, `acoes.mjs` (`efeitoDaGema`) | encaixe ligado | o uso da gema ativa | parcial (por suporte) |
| 4 | Itens e modificadores | `itens-poe/gerar.mjs` (sorteio), `itens-poe/jogo.mjs` (peça → `poe.af`), `itens-poe/traduzir.mjs` + `traducao.json` (texto → atributo tipado), `afixos.mjs` (soma), `itens-poe/moedas.mjs` | drops, moedas | soma de atributos | completo; as joias do PoE não viram item (`naoEquipaveis`) |
| 5 | Frascos e cargas | `itens-poe/frascos.mjs` (cinto, uso, cargas), `itens-poe/cargas.mjs` (Frenesi/Poder/Tolerância), Fúria em `condicoes-poe.mjs` | itens, eventos de abate/crítico | soma (o frasco ativo e as cargas entram em `Afixos.soma`), eventos | completo; os eventos "ao usar um Frasco" agora disparam (ciclo da árvore) |
| 6 | Habilidades, ataques e magias | `acoes.mjs` (gemas e skills), `hunt/combate.mjs` (golpe da arma), `poderes.mjs` (magias dos monstros no jogador) | ficha, gemas | o acerto (`ModsPoe.aoAcertar`, `AfeccoesPoe.aoAcertar`) | completo |
| 7 | Estados, buffs, debuffs, afecções | `itens-poe/afeccoes.mjs`, `combate/dot.mjs`, `skills/estados.mjs` (atordoar, congelar), `itens-poe/mods-poe.mjs` (estados no alvo: cego, mutilado, intimidado, exposição, empalado), `condicoes-poe.mjs` (`BUFFS`, `controleNoJogador`), `mods-poe.dotNoJogador` | o acerto, os eventos | dano contínuo, mitigação, condições `alvo*` | afecções e controle completos; faltam os debuffs do PoE Crueldade, Esmagado e Sangue Corrompido |
| 8 | Dano físico e elemental | `ficha.danoDoElemento` (aditivo), `condicoes-poe.fichaDoGolpe` (o condicional por tag), `acoes.mjs` (`mult` da gema), `hunt/combate.mjs` | soma, tags do golpe | o acerto | completo |
| 9 | Defesa (armadura, evasão, bloqueio, escudo) | `ficha.defesasDaFicha` (por peça), `personagem/defesa.mjs` (`absorver`, `recarregar`, esquiva), bloqueio em `hunt/combate.mjs` (ataque) e `poderes.mjs` (magia) | soma, atributos | o dano recebido | completo; a mitigação da armadura do jogador não tem "defender com X%" |
| 10 | Crítico, precisão, exposição, penetração, resistências | `ficha` (crit*), `Ficha.rolarCritico`, `personagem/atributos` (chance de acerto), exposição em `mods-poe`/`condicoes-poe.exposicao`, penetração no `fichaDoGolpe`, `hunt/resistencia.mjs` | soma, golpe | o acerto | completo |
| 11 | Regeneração, recuperação, dreno | `ficha.regenDoPoe`, `cacadas.regenerar`, `condicoes-poe.tique` (regeneração de ES, perdas), `ficha.aplicarLeech`/`recuperarRoubo` (instâncias e teto do PoE), `frascos.recuperar` | soma | vida, mana, escudo | completo; falta o dreno instantâneo (Pacto Vaal) |
| 12 | Atributos finais | `Ficha.combate`: `Afixos.soma` → `comOsModsDoPoe` (`ModsPoe.resolver`: condição de estado e escala) → `porTag` (golpe) → `eventosDa` → 2ª passada `escalasDaFicha` → keystones | tudo acima | combate, tela, comparação de itens | completo; um cálculo só |
| 13 | Persistência e WebSocket | `websocket/sessao.mjs` (`despacharPassivas`, frascos, gemas…; autosave 30 s `gravarAgora`; ao sair, `soltarPersonagem`), `database/banco.mjs` (estado JSON) | — | o servidor é a autoridade; o cliente só pede e mostra | completo |

**Um cálculo só.**
- A árvore, as peças, as gemas e os frascos entram na mesma soma (`Afixos.soma`), com as mesmas chaves tipadas (`stat%escala@cond`).
- O combate lê a mesma ficha (`ModsPoe.valor`, `fichaDoGolpe`).
- O cliente não aplica bônus: só soma os efeitos dos nós para exibir "o que a árvore dá".
- Neste ciclo saiu uma duplicação: o Juramento do Zelote tinha dois caminhos (a peça em `cacadas.regenerar`, a árvore em `regenDoPoe`). Agora é um.

## 2. Fluxos de ponta a ponta (conferidos)

**Maldição**
- **Fluxo:** árvore (efeito, duração, "menos efeito", "Maldição adicional", "expirou X%", "Desacelerados", Mestre dos Feitiços) → gema de maldição (arquétipo `maldicao`, `acoes.efeitosDaMaldicao`: os efeitos × efeito, a duração e o efeito `maldicaoRegras`) → o buff ligado (com a hora em que foi lançado) → o acerto (golpe básico em `hunt/combate`, gemas em `acoes`) → `Reforcos.marcar`: a maldição no monstro (`bicho.maldicoes`, com o limite e a duração do PoE) → o dano a mais (`vulnerabilidade`), o monstro enfraquecido (`forcaDoBicho`), o passo dele (`moverMonstros`), o crítico dele em você (`criticoDoBicho`), as regras "@alvoAmaldicoado" (`tagsDoAlvo`) e o evento `amaldicoarSemMaldicao`.
- **Monstro ↔ maldição** (ciclo 4): o monstro "Infeitiçável" (Hexproof, mod do PoE) recusa o Feitiço (a Marca pega; a Ocultista passa); "Reflete Feitiços" devolve o Feitiço para você; o escudo de energia do monstro (mod do PoE) recarrega — e o amaldiçoado com "não podem Recuperar Escudo de Energia" não; a regeneração dele cai; o amaldiçoado "destruído" não deixa cadáver. O monstro "Amaldiçoa" põe Fraqueza Elemental, Vulnerabilidade ou Enfraquecer em você (`condicoes-poe.addsDasMaldicoesNoJogador` → a sua soma), que "Imune a Maldições", "Efeito das Maldições em você" e "Suas Resistências Elementais não podem ser reduzidas por Maldições" seguram.
- **Situação:** **fechado nos ciclos de maldições/dreno e 4**; 108 de 118 linhas da categoria com efeito, 43 efeitos validados por teste (eram 4). Pendente: "Efeito de Auras Não-Maldição de suas Habilidades aumentado nos Inimigos" (1 linha).
- **Defeito achado e corrigido:** a maldição da gema não contava como "Inimigo Amaldiçoado" (10 linhas, 28 efeitos da árvore: "Recupera X% de Vida ao Matar um Inimigo Amaldiçoado", as chances de afecção contra amaldiçoados).

**Dreno**
- **Fluxo:** árvore/peças (`life_leech`, `mana_leech`, `es_leech`, `es_leech_magia`, `vida_leech_magia`, `roubo_instantaneo_pct`, os tetos) → a ficha do golpe (as tags: corpo a corpo, ataque, magia) → `Ficha.aplicarLeech` (a parte instantânea na hora; o resto vira instância de até 10% do máximo) → `Ficha.recuperarRoubo` no tique (2%/s por instância; teto por recurso — `tetoDoRouboPct`; o recurso livre cheio encerra o dreno) → vida/mana/escudo.
- **Totem e excedente** (ciclo 4): o golpe físico de ataque do totem drena para o dono (`cacadas.golpeDoTotem`); o acerto que mata drena o excedente (`mods-poe.aoAcertar`). Os dois pelo mesmo `Ficha.drenarPoe`.
- **Situação:** **fechado**; 127 de 136 linhas da categoria com efeito, 0 pendentes, 84 efeitos validados (eram 23). As 9 "inexistentes" são o "mais Dano contra Inimigos que não podem ter Vida Drenada" (no jogo todo monstro pode).

**Frasco**
- **Fluxo:** árvore ("Maestria de Frascos") → frasco no cinto (`frascos.cinto`) → cargas (`ev:critico:frascoChance`, cargas por abate) → uso (`{t:'frasco', action:'usar'}` → `Frascos.usar`) → eventos "ao usar" (`ModsPoe.eventosDoFrasco`) → o efeito ativo entra na soma → ficha.
- **Situação:** fechado neste ciclo; testado em `passivas-poe.test.mjs`.

**Afecções**
- **Fluxo:** árvore ("Ataques com Machados causam Dano com Afecções aumentado", `ailment_dmg_inc@ataque+comMachado`) → condição da arma na mão (`condicoesDe`) → golpe de ataque (`fichaDoGolpe` → `finalizar` recalcula `afeccoes`) → acerto (`AfeccoesPoe.aoAcertar`) → incêndio posto no monstro (`Dot.aplicar`).
- **Situação:** fechado e validado neste ciclo; o dano contínuo sobe na razão exata.

**Lacaio**
- **Fluxo:** árvore ("Lacaios causam Dano aumentado" → `minion_dmg`) → gema de lacaio (`lacaios-poe.mjs`) → o golpe do lacaio lê `minion_dmg` da ficha do dono.
- **Situação:** existe, mas 0 de 103 efeitos têm teste. Os atributos de lacaio além de dano/vida/velocidade (área, recarga, penetração) não existem no lacaio.

**Empalamento de gema**
- **Fluxo:** gema ("40% de chance de Empalar", 7 gemas) → `GemasPoe.fichaComAsChancesDaGema` → `ModsPoe.aoAcertar` (o mesmo empalamento dos itens e da árvore).
- **Situação:** a ligação faltava; fechada neste ciclo.

## 3. As categorias do editor (números do grafo gerado)

A tabela completa, com os atributos, os consumidores e as gemas de cada categoria, está no grafo gerado. Resumo das que pesam mais:

| Categoria | Nós | Linhas com efeito | Pendentes | Validado por teste | O que falta (dependência) |
|---|---:|---:|---:|---:|---|
| Afecções e controle | 441 | **541 (88%)** (era 391) | 31 (eram 208) | **414/692** (era 6) | o sangramento agravado e em movimento; projéteis atravessados/ricocheteados; o Liberto; a Geada |
| Lacaios | 91 | 103 (54%) | 83 | **62/103** (era 0) | os atributos do lacaio além de dano/vida/velocidade/máximo |
| Armadilhas e Minas | 63 | 60 (43%) | 80 | 0/60 | armadilhas e minas de verdade (armar, detonar, limite); no jogo são golpes comuns |
| Marcas e Runas | 40 | 7 (8%) | 70 | 7/7 | marcas presas ao inimigo (vínculo); as tags Runa/Marca agora existem |
| Maldições | 75 | **108 (92%)** (era 62) | 1 (eram 47) | **43/126** (era 4) | auras não-maldição nos inimigos |
| Atordoamento | 117 | 99 (63%) | 51 | **41/103** (era 0) | duração do atordoamento crítico, ignorar atordoamento ao conjurar |
| Fúria, cargas e poder | 118 | 119 (71%) | 41 | **52/119** (era 0) | ganhos/perdas específicos (Fúria Arcana, perda que começa depois) |
| Precisão e crítico | 267 | 354 (85%) | 61 | 230/364 | precisão "mais" contra únicos/de perto |
| Defesa e armadura | 299 | 320 (84%) | 43 | 231/376 | defender com armadura extra, teto de bloqueio |
| Dreno | 81 | **127 (93%)** (era 52) | 0 (eram 37) | **84/128** (era 23) | — |
| Canalização e repetição | 10 | 0 | 26 | — | estágios de canalização, intensidade, selos (ausente) |
| Debuffs do PoE / Reflexo / Solo / Cadáveres / Encaixes | — | ~0 | — | — | sistemas ausentes (ver a auditoria da árvore) |

## 4. A matriz de pré-requisitos (o que destrava o quê)

| Pré-requisito (sistema compartilhado) | Destrava | Situação |
|---|---|---|
| Modificador tipado + soma única (`traduzir` → `Afixos.soma` → `Ficha.combate`) | toda a árvore, peças, gemas, frascos | pronto (e auditado) |
| Tags de golpe produzidas pelas gemas (`TAG_DO_POE`) | toda regra `@runa`, `@marca`, `@feitico`, `@golpe`, `@canalizar`… | **corrigido neste ciclo** (10 tags faltavam) |
| Condições de estado (`condicoesDe`: arma na mão, escudo, vida, cargas, buffs) | 1.434 efeitos condicionais | pronto; armas validadas neste ciclo |
| Eventos (`ModsPoe.evento`) disparados por quem faz a ação | os 158 efeitos "ao matar/bloquear/usar…" | os de frasco faltavam: **corrigido** |
| Fluxo de afecções (ficha → golpe → acerto → dano contínuo) | afecções da árvore, chances das gemas, mods das peças | **validado neste ciclo** |
| Ficha do golpe com as chances da gema (`fichaComAsChancesDaGema`) | a chance de empalar das gemas (e futuras: cegar, mutilar) | **corrigido neste ciclo** |
| Lacaio com atributos próprios (`lacaios-poe.mjs`) | Lacaios, Totens, Oferendas, Égide Necromântica | parcial: dano/vida/velocidade/dano somado/resistências; faltam área, recarga, penetração |
| Objeto plantado (armadilha/mina com armar e detonar) | Armadilhas e Minas (80 linhas), keystones de mina | ausente: as gemas viram golpe comum (decisão de design) |
| Vínculo de marca no monstro | Marcas e Runas (70 linhas), Mesclador de Runas | ausente |
| Maldição no monstro com as regras do PoE (`Reforcos.marcar`: limite, duração, Marca à parte, a lançada por último) | Maldições (todas as linhas de efeito/duração/limite/"expirou"/lentidão), as regras "@alvoAmaldicoado" | **pronto** (ciclo de maldições e dreno) |
| Dreno com parte instantânea, teto por recurso e fim no recurso livre cheio | Dreno, Pacto Vaal, maestrias de Dreno e de Garra | **pronto** (idem) |
| Um ponto de checagem "só recupera vida pelo dreno" (`vidaSoPeloDreno`) | Pacto Vaal (árvore e peças) | **pronto**: regeneração, vida por acerto/abate, eventos, frascos, cura, recarga na vida |
| Um dreno compartilhado (`Ficha.drenarPoe`) | o acerto, o golpe do totem, o dano excedente | **pronto** (ciclo 4) |
| Escudo de energia do monstro com recarga (`skills/estados.escudoDoMonstro`) | os mods de escudo do PoE, "não podem Recuperar Escudo de Energia" | **pronto** (ciclo 4) |
| Maldições dos monstros em você (`hunt.maldicoesNoJogador` → a sua soma) | "Amaldiçoa", "Reflete Feitiços", "Resistências não podem ser reduzidas por Maldições", "Imune a Maldições", "Efeito das Maldições em você" | **pronto** (ciclo 4) |
| Joia como item | 57 encaixes da árvore | ausente (item "Joias" do roteiro) |
| Óleos/Unção | 30 notáveis de unção | ausente (roteiro: óleos só dos pináculos) |

## 5. Ordem de implementação recomendada (e por quê)

A ordem segue o código e os números, não a ordem do editor.

1. **Validar e fechar os fluxos que existem e não têm teste.** É o que mais sobe a cobertura real, e onde há quebra escondida aparece aqui (como apareceram neste ciclo o empalamento das gemas e os eventos de frasco). Pela ordem de volume:
   - Lacaios (0/103);
   - Fúria/cargas (0/119);
   - Maldições (0/76);
   - Atordoamento (o resto);
   - Dreno.
2. **Ligações gema ↔ mecânica existente.** Chances, durações e tags que a gema declara e o motor já sabe fazer, como o empalamento deste ciclo. Barato, e serve à árvore, às gemas e aos itens ao mesmo tempo.
3. **Mecânicas de base usadas por muitos nós:**
   - afecções em você ("enquanto tiver uma", limite) — mexe em `dotNoJogador` e `controleNoJogador`;
   - duração da maldição;
   - "defender com armadura".
4. **Mecânicas especializadas de gema.** Pedem decisão de design, porque mudam o jogo:
   - estágios de canalização;
   - armadilhas e minas plantadas;
   - marcas vinculadas.
5. **Itens:** joias (com o item no roteiro), óleos e unção.
6. **Keystones restantes**, cada uma quando o sistema dela existir (a tabela C4 da auditoria da árvore diz qual falta).

## 6. O que este ciclo implementou (fluxos completos, com teste)

| Fluxo | Sistemas ligados | Nós / efeitos afetados | Teste |
|---|---|---|---|
| Afecções de ponta a ponta + condições de arma | árvore → condição → golpe → acerto → dano contínuo | 285 efeitos de afecção validados (eram 6); 9 condições de arma | `passivas-poe-afeccoes.test.mjs` |
| Atordoamento no monstro | árvore → golpe → `aoAcertar` → `Estados.atordoar` | 41 efeitos validados | idem |
| Evitar afecções em você | árvore → ficha → `controleNoJogador` | `avoid_elem_ailments` | idem |
| Empalamento das gemas | gema → ficha do golpe → `aoAcertar` | 7 gemas | `itens-poe-gemas-degenerativo.test.mjs` |
| Eventos de frasco | sessão → `eventosDoFrasco` → `ModsPoe.evento` | 16 linhas das maestrias de frasco + mods de itens | `passivas-poe.test.mjs` |
| Equilíbrio Elemental (o atual, por Exposição) | árvore → acerto → Exposição → resistência do monstro | keystone 39085 | `passivas-poe-keystones.test.mjs` |
| Juramento do Zelote num caminho só (árvore + peça) | regeneração → escudo | keystone 63425 + os únicos | idem |
| **Defeito corrigido — máximo de lacaios**: "+1 ao número Máximo de Zumbis/Esqueletos/Golens/Totens" entrava na invocação, mas a checagem "já estão todos em campo" (`acoes.mjs`, `dispararSemMarcar`) calculava o máximo SEM a soma do dono, e a gema era recusada antes do lacaio a mais | árvore/peças → `oQueInvoca(…, afPoe)` nos dois pontos → a caçada invoca | 12 efeitos `max_lacaio:*` (+ os de peças) | `passivas-poe-lacaios.test.mjs` (reproduzido sem a correção: 4/5 zumbis; com ela: 5/5) |
| Lacaios: vida e dano da árvore no lacaio invocado | árvore → soma do dono → `oQueInvoca` → zumbi em campo | 62 de 103 efeitos de lacaio validados | idem |
| Duração da maldição (era sem consumidor) | árvore → `efeitosDaMaldicao` → buff da maldição → `Reforcos.marcar` → a marca no monstro | 4 efeitos + mods de itens | `passivas-poe-afeccoes.test.mjs` |
| Cargas e Fúria | árvore → regras das cargas/Fúria → o que a caçada guarda | 52 de 119 efeitos validados | `passivas-poe-cargas.test.mjs` |
| Frascos de ponta a ponta | árvore → soma do personagem → frasco no cinto → `usar`/`tique`/`aoMatar` → vida recuperada, duração ativa, cargas | 99 de 130 efeitos de frasco validados (eram 24) | `passivas-poe-frascos.test.mjs` |
| **Maldições do PoE no monstro** (ciclo de maldições e dreno) | árvore → `efeitosDaMaldicao` (`maldicaoRegras`) → buff → acerto → `Reforcos.marcar` → dano, força, passo e crítico do monstro, `tagsDoAlvo`, evento `amaldicoarSemMaldicao` | Maldições: 98 linhas com efeito (eram 62), 33 validados (eram 4); keystone Mestre dos Feitiços | `passivas-poe-maldicoes-dreno.test.mjs` (um teste numa caçada de verdade: o golpe básico amaldiçoa e a mana volta pelo evento) |
| **Defeito corrigido — alvo amaldiçoado**: as regras "@alvoAmaldicoado" só viam o dano contínuo "maldição" dos monstros, nunca a maldição da gema | `tagsDoAlvo` lê `bicho.maldicoes` | 10 linhas / 28 efeitos | idem (com mutação: sem a correção, falha) |
| **Dreno instantâneo e teto por recurso** | árvore/peças → ficha do golpe → `aplicarLeech` (parte instantânea) → `recuperarRoubo` (`tetoDoRouboPct`; o recurso livre cheio encerra) | Dreno: 120 linhas com efeito (eram 52), 77 validados (eram 23); keystone Pacto Vaal | idem |
| **Ciclo 4 — dreno dos totens e do excedente** | árvore → `cacadas.golpeDoTotem` / `mods-poe.aoAcertar` → `Ficha.drenarPoe` | 6 opções da Maestria de Totens + o Carrasco | `passivas-poe-maldicoes-dreno.test.mjs` |
| **Ciclo 4 — monstros à prova, refletindo, com escudo e amaldiçoados** | mods do PoE → `raridade.aplicar` → `Reforcos.marcar` / `skills/estados.tique` / `processarMortes` | Autoridade Profana, Últimos Ritos; 9 mods de monstro que eram registrados ou "+40% de vida" | idem |
| **Ciclo 4 — maldições dos monstros em você** | "Amaldiçoa"/"Reflete Feitiços" → `hunt.maldicoesNoJogador` → `Afixos.soma` → a ficha | 6 opções da Maestria de Maldições (era inerte) | idem |
| **Ciclo 5 — afecções em você** | monstro (golpe, magia, controle) → `dotNoJogador`/`controleNoJogador`/`dispararMagia` → o pulso (`Mecanicas.tique`) | Maestria de Proteção, Maestria de Supressão Mágica, Cauterização, Sombra Fluvial (keystone, as duas linhas), o Campeão, o Carrasco; Afecções e controle de 391 para 413 linhas com efeito | `passivas-poe-afeccoes-em-voce.test.mjs` |
| **Ciclo 6 — afecções do personagem nos monstros** | árvore → ficha do golpe → `afeccoes.aoAcertar`/`mods-poe.aoAcertar`/`aoPorAfeccoes` → o monstro → `resistido`/`doBicho`/`criticoDoBicho` | Afecções e controle de 413 para 541 linhas com efeito; keystones Agonia Perfeita, Dança Carmesim e O Empalador | `passivas-poe-afeccoes-nos-monstros.test.mjs` |
| **Defeito corrigido — resistência negativa**: no PoE, toda resistência negativa dos atributos virava 0 antes da conta do PoE | `ficha.mjs` (a soma bruta) | peças com "−X% de Resistência", as maldições | idem (com mutação) |
| **Defeitos corrigidos — dreno**: "Dreno é Instantâneo" (9 linhas) e 18 linhas de teto eram inertes com notas falsas ("o dreno do jogo já é instantâneo"/"não tem teto"); a regra genérica de "Reserva" engolia 11 linhas de dreno; o teto "do Dreno de Vida/de Mana" subia o de todos os recursos | `traducao.json` | 38 linhas inertes que passaram a valer (+ o teto por recurso) | idem; `itens-poe-arvore-poedb.test.mjs` (classe C: a asserção antiga dizia que o dreno instantâneo não existia) |

## 7. Lacunas restantes e próxima prioridade

- **Restantes:** as categorias da seção 3 com "validado" baixo, mais os sistemas ausentes da seção 4. Os detalhes estão no grafo gerado.
- **Suíte SYSTEM depois do merge da main (#181, #182):** 318 arquivos, 3.295 testes, 2.715 passam, **0 falhas**, 578 pulados. Três testes tiveram a premissa corrigida: `passivas-poe-lacaios`, `xp-da-hunt` e `so-itens-do-poe` (ver a seção 9 da auditoria da árvore).
  - **Efeito no jogo do escudo dos monstros do PoE puro:** quem bate devagar fica preso no Elite/Raro com "Início da Recarga 150% mais rápido". Na Costa, em 3 h, com o cavaleiro desarmado: 19 de 40 sementes abaixo de 500 abates; na main, todas acima de 792. A velocidade da arma no golpe básico resolve para quem está armado.
- **Suíte SYSTEM no fim do ciclo 6:** 317 arquivos, 3.289 testes, 2.709 passam, **0 falhas**, 578 pulados.
- **Suíte SYSTEM no fim do ciclo 5:** 316 arquivos, 3.278 testes, 2.698 passam, **0 falhas**, 578 pulados.
- **Suíte SYSTEM no fim do ciclo 4:** 315 arquivos, 3.271 testes, 2.690 passam, 1 falha — `loot-moeda.test.mjs`, intermitente e antiga (as mesmas sementes travam no `origin/main`).
- **Feito no ciclo 4:** os quatro itens que tinham sobrado (o dreno dos totens e do excedente; o monstro à prova de maldições; a regeneração, o escudo e o "destruído" do amaldiçoado; as maldições dos monstros em você, com a linha de resistências que era inerte) e o defeito da resistência negativa cortada em 0.
- **Suíte SYSTEM no fim do ciclo de maldições e dreno:** 314 arquivos, 3.260 testes, 2.680 passam, **0 falhas**, 578 pulados (B/C do clássico).
- **Feito no ciclo de maldições e dreno:** as duas prioridades anteriores (maldições e dreno instantâneo), com o Pacto Vaal e o Mestre dos Feitiços.
- **Próxima prioridade:**
  1. **O sangramento em movimento e agravado** (decisão de balanceamento: no PoE o sangramento dói mais com o alvo andando — o jogo não tem isso, nem em você nem nos monstros), e o resto de Afecções (31 linhas). As afecções do personagem nos monstros foram fechadas no ciclo 6.
  2. **As auras não-maldição nos inimigos** (a última linha pendente de Maldições) e os mods de monstro do PoE ainda só registrados (102 de 204).
  3. **A velocidade de ataque da arma do PoE no golpe básico** (lacuna antiga, achada no ciclo 4): no modo PoE o golpe básico ataca a cada 2 s para todo mundo. Com o escudo dos monstros do PoE puro (decisão do dono), quem depende do golpe básico pode ficar preso num monstro com "Início da Recarga 150% mais rápido".
