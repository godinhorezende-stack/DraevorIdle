# Relatório da auditoria de modificadores — Draevor

Escopo: **somente leitura**. Nenhum valor, tier, regra, item, banco ou economia foi alterado. Tudo abaixo vem do código e dos dados reais (`gamedata/itens/*.json`, `game/systems/itens/*`, `game/systems/afixos.mjs`) e cada achado tem prova em `game/testes/auditoria-modificadores.test.mjs` (18 testes, todos passando) ou em testes que já existiam. Inventário completo, por categoria, em [README.md](README.md); dados em [inventario.json](inventario.json); gerado por `node tools/auditar-modificadores.mjs`.

## A. Resumo do sistema atual

- **Nome e modelo.** O jogo chama de "atributos"/"adds" (código: `afixos`). Existem **56 modificadores cadastrados (54 caem)** e **18 legados** (que não caem mais). **Não existe prefixo nem sufixo, nem grupo de modificadores, nem tags**: uma peça recebe N modificadores **distintos** de um pool do tipo dela, e a única regra de exclusão é "não repetir o mesmo id".
- **Cadastro (fonte única):** `gamedata/itens/atributos.json` (nome, tipo `flat`/`pct`, categoria, peso, faixa de cada tier, `nivelMinimo`, raridades permitidas, `dropa`, `valorPorRaridade`). Pools por tipo de item: `pools.json`. Tiers por Item Level, pesos e viés da raridade: `tiers.json`. Quantidade por raridade: `raridades.json`. Tudo carregado e validado no boot por `systems/itens/config.mjs`. O catálogo derivado `FICHAS` (74 = 56 + 18 legados) é montado a partir disso e é o que o servidor e o cliente leem — **não há regra duplicada em código**: o teste M3 confirma que nome, tipo, mínimo, máximo e as faixas do catálogo são idênticos às do arquivo.
- **Tiers.** São 5 (T1–T5) para todos os 56. **T1 é o MAIS FRACO e T5 o MAIS FORTE** (regra do dono, escrita em `atributos.json`/`tiers.json`) — o inverso do PoE 1. O Item Level libera os tiers: 1–100 → T1–T2; 101–600 → T1–T3; 601–1200 → T1–T4; acima de 1200 → T1–T5 (`tiers.json`). Entre os liberados, o sorteio é `peso × viés^(tier−1)` (pesos 100/60/30/12/4; viés da raridade 1 a 2,5; amuleto ×1,2; boss de ato +10% no Item Level). Cada add também tem um Item Level mínimo próprio (1, 20, 101 ou 301).
- **Geração** (`systems/itens/gerar.mjs`, o único lugar com sorte de item): raridade → Item Level → base → pool filtrado (`poolDe`: `dropa`, `nivelMinimo`, raridade e, fora anel/amuleto, defesa que a base não tem) → quantidade pela raridade → sorteio sem repetição pelo peso → tier → valor dentro da faixa do tier. Quantidades: comum 0; incomum 1–2; raro 2–3; épico 3–4; lendário 4–5; mítico 5–6.
- **Aplicação.** `Afixos.somaDeItens` soma o valor guardado de cada mod das peças **vestidas** (+ árvore de passivas + altares); a ficha, os requisitos e a comparação leem essa soma. O valor é o da peça, sem escala.
- **Persistência.** A peça é JSON dentro do estado do personagem (`af: [{ id, nivel, value, rr? }]`, `raridade`, `ilvl`…); `camposDaPeca` leva tudo junto ao mover.
- **Exibição.** O catálogo (`FICHAS`) viaja para o cliente; o tooltip lê tipo e faixas dele (`getCatalogo()?.afixos`) e o valor da peça. Não existe editor administrativo de mods: o único caminho é editar o JSON.

## B. Lista completa T1–T5

Em páginas por categoria (cada uma com a tabela T1–T5 real, Item Level mínimo, peso, raridades, pools e Item Level a partir do qual cada tier é possível): [01 atributos](01-atributo.md) · [02 ofensivos](02-ofensivo.md) · [03 defensivos](03-defensivo.md) · [04 resistências](04-resistencia.md) · [05 regeneração](05-vida.md) · [06 utilitários](06-utilidade.md) · [07 avançados](07-avancado.md) · [08 legados](08-legado.md) · [compatibilidade](09-compatibilidade.md) · [progressão](10-progressao-dos-tiers.md).

Contagem por categoria: atributos principais 3 · ofensivos 19 · defensivos 11 · resistências 7 · regeneração 4 · utilitários 4 · avançados 8.

### Cobertura das categorias pedidas (só o que existe)
| Pedido | No Draevor |
|---|---|
| Dano adicional / % físico | `phys_add` ("Dano adicional": soma um mínimo e um máximo ao ataque; T1 10–20, T2 15–30, T3 22–44, T4 34–68, T5 50–100; substituiu o `atk_flat`/Attack, e as peças antigas são convertidas ao carregar, mesmo tier) / `phys_dmg` (%) |
| Dano elemental adicional (número) | **não existe** — só % por elemento |
| Fogo, gelo, elétrico, veneno/terra, sagrado, morte | `fire_dmg`, `ice_dmg`, `energy_dmg`, `earth_dmg`, `holy_dmg`, `death_dmg` (%) |
| Caos | **não existe** (os elementos do jogo são physical, fire, ice, earth, energy, death, holy) |
| Dano mágico genérico | **não existe** hoje (`spell_dmg` é legado, convertido em INT) |
| Ataque mínimo/máximo | **não existe como mod** (a faixa de ataque vem da base da peça pela raridade) |
| Velocidades, crítico, precisão | `atk_speed`, `cast_speed`, `crit_chance`, `crit_dmg`, `accuracy` |
| Penetração | `phys_pen`, `elem_pen` (global); **por elemento não existe como mod** (o motor aceita `porElemento` de outras fontes) |
| Dano contra tipos | `dmg_vs_boss`, `dmg_vs_monsters`, `dmg_vs_elite` (desligado) |
| Vida, mana, armadura, evasão, Energy Shield | `life`, `mana`, `armor_flat`/`armour_pct`, `evasion`/`evasion_pct`, `energy_shield`/`es_pct` |
| Resistências | `phys_res` + as seis elementais (sem caos) |
| Bloqueio, esquiva, redução de dano | `block`, `spell_block`, `avoid_damage`, `dmg_reduction`, `control_resist` |
| Regeneração, roubo | `life_regen`/`mana_regen` (número), `*_regen_pct`, `life_leech`, `mana_leech` |
| Movimento, recarga, custo | `move_speed`, `cooldown_recovery`, `skill_cost` |
| Itens/ouro/exp | `loot_bonus`, `gold_find`, `exp_bonus` (raridade/quantidade de item separadas **não existem**) |
| STR/DEX/INT, nível de gema | `str`, `dex`, `int`, `gem_level` |
| Suportes | **não existe** |

## C. Modificadores incompletos
- Sem tiers / com tier faltando / sem faixa / sem nível mínimo: **nenhum** — os 56 têm T1–T5, faixa e `nivelMinimo` (teste M2/M3/M5).
- Sem compatibilidade definida ou fora de todo pool: **nenhum** (M1).
- **Cadastrados e desligados do drop (`dropa:false`):** `dmg_vs_elite` (à espera de monstros Elite) e `atk_flat` (Attack, substituído pelo Dano adicional em 03/10; as peças antigas são convertidas para `phys_add` na versão 6 dos itens). Está nos pools mas nunca cai (G4 prova 0 em 20 mil peças míticas).
- **Sem faixa por tier de verdade:** `gem_level` — o valor vem da **raridade** (`valorPorRaridade`: incomum/raro +1, épico/lendário/mítico +2); as cinco faixas (1, 1, 1, 2, 2) são só informativas.
- Legados (18): fora do drop e convertidos ao carregar a peça (`renomearAdds`); teste P2 prova a conversão preservando tier e posição na faixa.

## D. Problemas de funcionamento
**Nenhum erro funcional comprovado** nesta auditoria. O que foi provado funcionando:
- Geração (G1: ≈ 8 mil peças semeadas em 11 tipos × 10 Item Levels × 6 raridades): 0 violações de id repetido, pool do tipo, `dropa`, `nivelMinimo`, raridade, tier liberado pelo Item Level, valor dentro da faixa do tier, valor inteiro nos `flat`, quantidade da raridade.
- Probabilidades (G2/G3): o tier sorteado bate com a fórmula em < 1 ponto percentual (100 mil sorteios por caso) e a quantidade por raridade bate com a tabela.
- Defesa da base (G6): `armor_flat`/`armour_pct` nunca saem em peça sem armadura.
- Aplicação (A1): para os 56, o valor guardado = o aplicado em `Afixos.soma` = o mostrado em `viewDoAfixo` (inclusive unidade `%`). Efeito real no combate: as 57 sondas de `atributos-efeito.test.mjs` passam e A2 confirma que cada um dos 56 mods tem a sua.
- Persistência (P1/P2): equipar, desequipar, trocar e gravar/ler no banco (mochila, equipamento, depósito) mantêm os mods idênticos, sem duplicar. **Não testado:** troca entre jogadores, mercado, reinício real do servidor (o estado é o mesmo JSON, mas não rodei esses fluxos), e o tooltip num navegador.

**Pontos de atenção técnicos (não são erros hoje):**
1. **Leitura de tier por valor em fronteiras.** `nivelDoValor` devolve o tier mais alto cuja faixa começa abaixo do valor; com fronteira compartilhada ou sobreposição, um valor de borda é lido como o tier de cima (teste A4: `armor_flat` 11 → T5; `spell_block` 3,2 → T4, apesar de estar em T3). Só importa quando a peça NÃO traz `nivel` (peças antigas/conversão); com o `nivel` guardado a leitura é a do sorteio.
2. **`MAX_AFIXOS = 3`** (`afixos.mjs`) é um valor antigo que só serve de reserva em `maxAtributos` (que hoje devolve 0/2/3/4/5/6 pela raridade). Não tem efeito no jogo atual, mas é um número que engana quem lê o código.
3. **Peças com `af` fora do pool do tipo** são tratadas como "tortas" (`ehTorto`) — mecanismo existente para forja/peças antigas; não gerado hoje (G1).

## E. Problemas de balanceamento (suspeitas, não erros comprovados)
Progressão (programática, 14 achados em 5 mods — [10-progressao-dos-tiers.md](10-progressao-dos-tiers.md)):
- **`spell_block`: sobreposição real** — T3 (2–3,5) e T4 (3–5) se cruzam; T4 (3–5) e T5 (4,5–7) também; T1/T2/T3 compartilham fronteira (1 e 2).
- **Fronteira compartilhada** (o teto de um tier = o mínimo do seguinte): `phys_pen`, `elem_pen`, `double_attack` (T4/T5 em 4), `armor_flat` (T4/T5 em 11), `gem_level`.
- **Tiers idênticos:** `gem_level` T1=T2=T3 (1) e T4=T5 (2) — o tier não muda nada, só a raridade.
- Os demais 49 mods têm progressão limpa (teto sempre crescente, faixas sem sobreposição nem lacuna maior que a escala do tier).

Outras observações (sem proposta de valor):
- **Elementos × físico:** `phys_dmg` e cada um dos 6 elementos têm a MESMA faixa (2–20%) e o mesmo peso (50); como são 6 mods elementais separados, um dano elemental sai ~6× mais que o físico num pool que tem os sete.
- **Armadura × evasão/ES (valores fixos):** `armor_flat` T5 = 11–14, `evasion`/`energy_shield` T5 = 220–350. A escala de Armour da base é outra (valores pequenos do catálogo), então não são comparáveis a olho; vale conferir com a base antes de balancear.
- **Mesma faixa para pares:** `life` = `mana` (10–700), `phys_res` (1,2–12%) é menor que as elementais (1,6–16%).
- **Somas teóricas de um conjunto completo** (8 peças, todas com o mod em T5 máximo — cenário extremo, não esperado): `armour_pct`/`evasion_pct`/`es_pct` até 210% (sem teto no motor); `phys_dmg` 140%; dano elemental 120% cada; resistências elementais 112% (o motor corta em **75%** — `limites.json`); `control_resist` 105% (corta em 75%); crit e ataque duplo cortados em 100%. Ou seja: as resistências e o controle têm teto; **armour/evasion/ES % e os `%` de dano não têm teto** — são os candidatos a "combinação excessiva" (suspeita, depende do resto da fórmula).
- **Tier × Item Level:** T5 só existe acima de Item Level 1200 (campanha vai até 2000, boss +10%); quem joga as fases abaixo de 600 nunca vê T4/T5. É a regra escolhida; só registro a consequência.

## F. Comparação com o PoE 1
Em [poe1.md](poe1.md).

## G. Recomendações
**Correções técnicas (sem mudar valores):**
1. Decidir a regra de fronteira (teto de um tier < mínimo do seguinte) e fazer `nivelDoValor` ler o tier por faixa fechada, ou exigir `nivel` na peça convertida.
2. Remover ou comentar `MAX_AFIXOS` (usar só a tabela de raridades).
3. Endurecer `config.validar` se o dono quiser faixas disjuntas: hoje ela exige mínimo e máximo não decrescentes e média crescente a cada tier (por isso `spell_block` passa), **não proíbe sobreposição nem fronteira compartilhada**, e **pula** os mods com `valorPorRaridade` (`gem_level`), onde tiers idênticos não são conferidos.
4. Se for criar um editor, ele precisa ler/gravar `atributos.json` + `pools.json` (não há rota hoje) e revalidar com `config.validar`.

**Mudanças de design (decisão do dono, nada foi alterado):**
1. Rever `spell_block` (sobreposição), `gem_level` (tiers idênticos) e as fronteiras compartilhadas.
2. Avaliar teto para armour/evasion/ES % e para os `%` de dano.
3. Avaliar dano elemental somado (número), caos, dano mágico genérico, penetração por elemento e raridade/quantidade de item, hoje ausentes.
4. Avaliar prefixo/sufixo e grupos de exclusão (mods "da mesma família") se o dono quiser o modelo do PoE; hoje não há como impedir dois mods parecidos além do mesmo id.
