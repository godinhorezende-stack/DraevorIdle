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
- **Fluxo:** árvore ("Efeito da Maldição aumentado" → `efeito_maldicao`) → gema de maldição (arquétipo `maldicao`, `acoes.efeitosDaMaldicao`) → debuff no monstro (`marcaVulneravel`/`marcaEnfraquece` com `durMarca`) → o dano recebido pelo monstro.
- **Situação:** o fluxo existe, mas 0 de 76 efeitos têm teste. "Duração da Maldição aumentada" (pendente) não tem consumidor: a duração vem da gema.
- **Próximo ciclo:** validar e ligar a duração.

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
| Afecções e controle | 441 | 391 (64%) | 208 | **285/490** (era 6) | afecções em você (limite, "enquanto tiver uma"), empalar em você, resfriamento mínimo |
| Lacaios | 91 | 103 (54%) | 83 | **62/103** (era 0) | os atributos do lacaio além de dano/vida/velocidade/máximo |
| Armadilhas e Minas | 63 | 60 (43%) | 80 | 0/60 | armadilhas e minas de verdade (armar, detonar, limite); no jogo são golpes comuns |
| Marcas e Runas | 40 | 7 (8%) | 70 | 7/7 | marcas presas ao inimigo (vínculo); as tags Runa/Marca agora existem |
| Maldições | 75 | 62 (53%) | 47 | 4/80 (era 0) | "expirou X%", maldição sobre inimigo sem maldição, maldições em você; a duração foi ligada neste ciclo |
| Atordoamento | 117 | 99 (63%) | 51 | **41/103** (era 0) | duração do atordoamento crítico, ignorar atordoamento ao conjurar |
| Fúria, cargas e poder | 118 | 119 (71%) | 41 | **52/119** (era 0) | ganhos/perdas específicos (Fúria Arcana, perda que começa depois) |
| Precisão e crítico | 267 | 354 (85%) | 61 | 230/364 | precisão "mais" contra únicos/de perto |
| Defesa e armadura | 299 | 320 (84%) | 43 | 231/376 | defender com armadura extra, teto de bloqueio |
| Dreno | 81 | 52 (38%) | 37 | 23/52 | dreno instantâneo, dreno de escudo/mana por tipo |
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

## 7. Lacunas restantes e próxima prioridade

- **Restantes:** as categorias da seção 3 com "validado" baixo, mais os sistemas ausentes da seção 4. Os detalhes estão no grafo gerado.
- **Próxima prioridade:**
  1. **Maldições**: o "expirou X%" e a maldição sobre inimigo sem maldição. A marca no monstro já guarda quando começou.
  2. **Dreno**: o dreno instantâneo. O roubo do PoE já tem instância e teto; falta o "instantâneo" (Pacto Vaal e maestria).
  3. **Afecções em você** ("enquanto tiver uma", limite).
