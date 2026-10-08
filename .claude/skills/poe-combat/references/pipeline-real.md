# O pipeline de dano como está no código (08/10/2026)

Rastreado em `game/systems/hunt/combate.mjs`, `game/systems/acoes.mjs` e módulos de apoio. **Confira de novo antes de mexer** — os nomes
abaixo são pontos de partida, não um contrato. Onde houver `[conferir]`, o caminho não foi seguido até o fim.

## Golpe básico do jogador (arma)

`Cacadas.tique` → `round(estado, personagem)` (`hunt/combate.mjs`) → `golpear` (função interna de `round`):

1. **Contexto do golpe:** `Ficha.combate(estado)` (cache) + no PoE `ModsPoe.fichaDoGolpe(ficha, ModsPoe.tagsDoGolpeBasico(...), { estado })`.
2. **Acerto:** `Defesa.errou(...)` (`personagem/defesa.mjs`) com precisão × evasão; fórmula do PoE em `combate/formulas.mjs`
   (`chanceDeAcertoPoe`, `acertoComEntropia`). Bloqueio do monstro: `AtributosDoMob.bloqueou` (`mobs/atributos.mjs`).
3. **Dano base:** `R.golpeDoJogador` (faixa da arma; `systems/regras.mjs`) + duas armas alternando (`ficha.duasArmas`).
4. **Crítico:** `Ficha.rolarCritico(estado, base, alvo, eventos, ficha)` (`systems/ficha.mjs`); multiplicador em `combate/formulas.mjs`
   (`fatorCritico`).
5. **Partes por tipo:** físico + `parteElementalDoGolpe`, `elementalDosAtributos` (regra do Draevor), `danoSomadoDoPoe` (dano
   somado dos mods do PoE), `elementalDoImbuement`; conversões e "extra como" do PoE: `ModsPoe.transformarPartes`,
   `ModsPoe.extrasDoFisico`, `ModsPoe.semFisico`.
6. **Resistência, penetração, armadura (no monstro):** `hunt/resistencia.mjs` (`resistido`, `resistenciaEfetivaDe`) usando
   `combate/limites.mjs` (`resistenciaEfetiva`, `danoAposResistencia`, `LIMITES`); armadura do PoE em `combate/formulas.mjs`
   (`reducaoDeArmaduraPoe`).
7. **Aplicar e reagir:** vida do monstro; `Ficha.aplicarLeech` (roubo); `ModsPoe.aoAcertar` / `ModsPoe.aoPorAfeccoes`;
   `AfeccoesPoe.aoAcertar` (`itens-poe/afeccoes.mjs`: ignição, sangramento, veneno, congelar, eletrizar, resfriar); `CargasPoe.aoAcertar`
   (`itens-poe/cargas.mjs`); `ModsPoe.empurrar`; `Arvore.depoisDoGolpe`; `Reforcos.marcar`.
8. **Golpes extras:** ataque duplo, projéteis extras de arma de distância (`ModsPoe.alvosDosProjeteisExtras`), golpes secundários.
9. **Morte:** `processarMortes` → `matarMonstro` (exp, loot — ver `poe-loot` —, cargas/frascos/vida ao matar).

## Skill da barra (gema)

`Cacadas.tique` → `Combo.tiqueDoCombo` (`systems/combo.mjs`: prioridade/limite/rotação) → `Acoes.disparar` → `dispararSemMarcar`
(`systems/acoes.mjs`): condição do slot (`condicoesDoSlotBatem`), recarga/tempo de conjuração (`Gemas.tempoDeConjuracao`, conjuração
termina em `concluirConjuracao`), custo (`ModsPoe.escudoParaOCusto`), efeito da gema com suportes (`Gemas.efeitoNaSkill`), área
(`engine/areas.mjs`: `Areas.dentro`, `Areas.mudar`), lacaios (`LacaiosPoe.oQueInvoca`), projétil/área secundária
(`skills/golpes-secundarios.mjs` `secundarios`/`resolver`). O dano segue os mesmos passos 4–9 [conferir o caminho exato por gema].

## Monstro no jogador

`golpesDosMonstros` → `contraAtaque(estado, hunt, personagem, bicho, eventos)` (`hunt/combate.mjs`): esquiva/acerto e bloqueio
(`combate/formulas.mjs` `bloqueioFinal`), armadura (no PoE `ModsPoe.fatorDaResistenciaRecebida`, `ModsPoe.fixoRecebido`), outros tipos
do golpe (`AtributosDoMob.danoExtraDoGolpe`), energy shield antes da vida (`Defesa.absorver`, recarga `Defesa.recarregar`), controle
(`combate/controle.mjs`), dano contínuo (`combate/dot.mjs`, `ModsPoe.dotNoJogador`), estados (`skills/estados.mjs`).

## Contas puras (use estas, não reescreva)

- Modificadores flat / increased / more: `game/systems/combate/modificadores.mjs` (`calcular`, `simples`, `valorDe`).
- Fórmulas: `game/systems/combate/formulas.mjs`; coeficientes em `game/gamedata/combate/*.json`.
- Limites e resistência com penetração: `game/systems/combate/limites.mjs`.
- Cópia isomórfica (prévia na tela): `game/engine/formulas.mjs` — o servidor decide.

## Ferramentas

`game/systems/combate/registro.mjs` (registro de cada golpe), `combate/simulador.mjs`, `combate/simulador-mob.mjs`,
`combate/simulador-rotacao.mjs` (roda o `Cacadas.tique` de verdade).
