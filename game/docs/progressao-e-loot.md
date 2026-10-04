# Progressão de equipamentos (10 Atos, level 1–1000) e loot por dificuldade

Trabalho feito só no ambiente local (nada de commit, push, merge, deploy ou VPS). **Nenhum balanceamento foi aplicado**: o que está em uso é neutro (idêntico ao comportamento anterior); a proposta fica em `perfis` e só vale se você a salvar como override.

## 1. Diagnóstico do sistema que já existia
- **Geração de item** (`systems/itens/gerar.mjs`, `gerarItem`): drop → base → **raridade** (tabela `itens/raridades.json`: `chances[estágio 1–4][dificuldade]`, inclinada pela raridade do mob e com mínimo por origem) → quantos modificadores (por raridade) → quais (pool do tipo do item, filtrado por Item Level, raridade e defesa da base) → **tier do modificador T1–T5** (`itens/tiers.json`: o Item Level libera tiers — até 100: T1–2; até 600: T1–3; até 1200: T1–4; acima: T1–5 — com peso por tier × viés da raridade) → valor na faixa do tier → efeito (lendário/mítico).
- **A dificuldade já influenciava o loot de dois jeitos**: pela tabela de raridade (estágio × dificuldade) e **inflando o Item Level** (o level alvo da fase: Normal 8–100, Cruel 101–600, Merciless 601–2000), o que liberava tiers mais altos. É exatamente o que a nova regra manda **não** fazer: os equipamentos vão até o level 1000 e a dificuldade não cria level novo.
- **Não existia** o conceito de "tier da base" (T1–T23), nem Atos 1–10 de equipamento, nem configuração de loot por dificuldade. O catálogo (`item-catalog.json`) tem `minLevel` em 971 dos 1856 equipamentos; **só há bases até o level ~600** (por Ato, sem craft: Ato 1: 1088 · 2: 154 · 3: 183 · 4: 56 · 5: 5 · 6: 22 · **7 a 10: nenhuma**) e **49 peças "Crafted Draevor … V2" exigem level 2500** (acima do máximo de 1000; só saem da forja).
- **Atos**: a campanha legada tem 4 Atos (Normal 8–100, Cruel 101–600, Merciless 601–2000); o editor de Acts cria Atos 5+. As tabelas de raridade são dos estágios 1–4; o estágio do Ato sai de `atoPorLevel` (até 100 → 1, 400 → 2, 1000 → 3, acima → 4), então com equipamentos ≤ 1000 o **estágio 4 deixa de ser alcançável** e o **T5 de modificador também** (precisa de Item Level > 1200).
- **Boss**: usa a tabela da dificuldade de cima, raridade mínima e `equipamentoGarantido` por dificuldade (1/2/3 peças) — mantido.

## 2. Como a progressão compartilhada foi implementada
- `gamedata/progressao.json` (fábrica, nunca editada) + `systems/progressao.mjs`: **`progressao`** (compartilhada: nível máximo 1000, tabela dos 10 Atos com faixa e tiers, regra de tier da base, estágio de raridade por Ato, tabela de tiers de modificador opcional) e **`loot`** (por dificuldade). A consulta da faixa de um Ato **não recebe dificuldade**.
- Tabela implementada (idêntica à pedida): Ato 1 = 1–100 (T1–T2) … Ato 10 = 901–1000 (T10–T11), igual em Normal, Cruel e Merciless. Regra: tier da base = ⌊(level + 50 − 1) ÷ 100⌋ + 1 (reproduz a tabela inteira; level 1000 → T11).
- `basesDoAto(ato)` lista as bases de equipamento cujo level mínimo cai na faixa (craft fora; cada base pertence a um Ato só), com contagem por slot e tier; os **grupos de sets** compartilhados são os presentes de marco (`sets-de-marco.json`) que caem na faixa.
- Overrides: `gamedata/overrides/progressao.json` (só a diferença), aplicado no boot e re-aplicado a quente (Hot Reload); inválido é ignorado no boot e rejeitado no Hot Reload (fica a última versão válida).

## 3. Como as dificuldades influenciam o loot (todos neutros de fábrica)
Por dificuldade (`loot.facil|medio|dificil`):
| Parâmetro | Efeito | Neutro |
|---|---|---|
| `chanceDeDrop` | multiplica a chance de **equipamento** cair (moedas/gemas/poções não mudam) | 1 |
| `pesosDeRaridade` | multiplica o peso de cada raridade (depois normaliza para 100%) | `{}` |
| `chanceDeModificadorExtra` | chance de +1 modificador (limitada ao pool e ao teto da raridade + 1) | 0 |
| `pesosDeTier` | multiplica o peso de cada tier de modificador entre os que o Item Level libera | `{}` |
| `tierMaximo` | teto de tier (nunca libera mais que o Item Level) | vazio |
Compartilhado: `estagioDeRaridade` por Ato e `tiersDeModificador` (remapeia o desbloqueio de tiers pelo Item Level). A dificuldade **do conteúdo** (não o degrau do boss) escolhe o `loot` aplicado.

## 4. Parâmetros alterados
Nenhum valor de jogo mudou. Mudanças de código sem efeito por padrão: `gerarItem` e `sortearTier` leem o `loot` da dificuldade; `combate.mjs` multiplica a chance de drop de equipamento pelo fator (1 = igual); `tiersLiberados` aceita a tabela da progressão. As sementes antigas continuam gerando os mesmos itens (teste PG5).

## 5. Resultados do simulador — PROPOSTA ("proposta-1", não aplicada)
Distribuições exatas (conferidas por 30–40 mil sorteios do gerador real: amostra × teoria dentro de ~0,5 ponto percentual).
Proposta: tiers de modificador liberados T3 do level 101, T4 do 301, T5 do 501 (igual nas 3 dificuldades); estágio de raridade igual ao atual até o Ato 8 e **estágio 4 nos Atos 9–10**; Cruel: drop ×1,1, +1 modificador 5%, raridade (raro 1,05 · épico 1,10 · lendário 1,15 · mítico 1,15), pesos T3 ×1,15 / T4 ×1,4 / T5 ×1,8; Merciless: drop ×1,2, +1 modificador 12%, raridade (1,10 · 1,20 · 1,30 · 1,30), pesos T3 ×1,3 / T4 ×2,0 / T5 ×3,0; Normal neutro. T1/T2 mantêm o peso (peça básica segue viável).

| Ato | Dif. | Raro+ atual → proposta | Mods/item | Tier médio | T4 | T5 |
|---|---|---|---|---|---|---|
| 1 | Normal | 4,3% → 4,3% | 0,41 → 0,41 | 1,41 → 1,41 | – | – |
| 1 | Cruel | 9,8% → 10,3% | 0,61 → 0,67 | 1,42 | – | – |
| 1 | Merciless | 13,3% → 14,8% | 0,70 → 0,86 | 1,43 | – | – |
| 5 | Normal | 7,0% → 7,0% | 0,54 | 1,73 → 1,92 | 0 → 8,6% | – |
| 5 | Cruel | 11,7% → 12,3% | 0,71 → 0,78 | 1,75 → 2,05 | 0 → 12,3% | – |
| 5 | Merciless | 15,1% → 16,7% | 0,81 → 0,98 | 1,77 → 2,20 | 0 → 17,0% | – |
| 8 | Normal | 7,0% → 7,0% | 0,54 | 1,92 → 2,02 | 8,6% → 8,3% | 0 → 3,4% |
| 8 | Cruel | 11,7% → 12,3% | 0,71 → 0,78 | 1,96 → 2,23 | 9,4% → 11,4% | 0 → 6,3% |
| 8 | Merciless | 15,1% → 16,7% | 0,81 → 0,98 | 1,99 → 2,47 | 10,1% → 15,0% | 0 → 10,0% |
| 10 | Normal | 7,0% → 9,4% | 0,54 → 0,62 | 1,92 → 2,05 | 8,6% | 0 → 3,6% |
| 10 | Cruel | 11,7% → 13,5% | 0,71 → 0,81 | 1,96 → 2,25 | 9,4% → 11,6% | 0 → 6,5% |
| 10 | Merciless | 15,1% → 17,5% | 0,81 → 1,00 | 1,99 → 2,48 | 10,1% → 15,2% | 0 → 10,2% |

Itens com ≥ 3 modificadores e algum T ≥ 4 (amostra do gerador, 30 mil drops): Ato 10 — Normal 1,3% → 2,4%, Cruel 2,4% → 5,1%, Merciless 3,3% → 9,5%; Ato 5 — 0% → 0,8% / 2,9% / 6,3%. Sem regressão nos Atos baixos.

## 6. Limitações e pendências (decisões suas)
1. **Como as fases da campanha viram Atos de equipamento 1–10.** Hoje o Item Level vem do level alvo da fase (inflado pela dificuldade). Para a dificuldade deixar de inflar o level é preciso decidir o mapeamento fase → Ato/level de equipamento (as 48 hunts legadas têm Normal 8–100). Não alterei isso.
2. **Tabela pede T1 até T23, mas até o level 1000 só existem T1–T11.** Implementei T1–T11; T12–T23 ficam sem uso.
3. **O catálogo importado não tem bases nos Atos 7–10** (e quase nenhuma no 5–6): as 49 peças de level 2500 são do craft. Preciso saber se cria/relevela bases ou se as peças "Crafted V2" devem ser reajustadas a ≤ 1000. O simulador usa as bases do Ato mais próximo e avisa.
4. Aprovar a "proposta-1" (ou ajustar) — e o remapeamento da tabela de tiers de modificador, necessário para o T5 existir com equipamentos ≤ 1000.
5. "Regras especiais de bosses e hunts" e "exceções de conteúdo especial": a estrutura aceita só os campos acima; exceções por boss/hunt ainda não têm campo próprio.
6. Fora de escopo/não verificado: o editor não bloqueia exceções intencionais (só avisa).
