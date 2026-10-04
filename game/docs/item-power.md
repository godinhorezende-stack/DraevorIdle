# Item Power Base — Engine › Item Power

Indicador de **comparação** dos atributos base dos equipamentos. **Não é DPS**, força real do personagem nem garantia de equilíbrio em combate, e **nada aqui altera item, chance de drop ou combate**. Só os cinco atributos base entram; ficam de fora atributos principais, vida/mana, resistências, crítico, velocidades, afixos/modificadores, gemas, habilidades, conjuntos, efeitos e sinergias.

## Auditoria (o que existe de verdade no projeto)
- Catálogo: `ITEM_CATALOG` (1856 peças com slot; 8 slots de equipamento: weapon, shield, head, body, legs, feet, ring, neck — `ammo` e `backpack` ficam de fora). Campos: `attack` (valor ÚNICO: mínimo = máximo), `defense` (do escudo = **rating** de Block que a perícia Shielding converte em %; a arma conta **metade**, como em `ficha.bloqueioDaFicha`), `armor` (dividido em Armour / Evasion / Energy Shield pelo tipo da base — `faixaDoCampo`/`defesaDoCatalogo`, o mesmo caminho da ficha), `minLevel` (só 971 das 1856 peças têm), `vocations`, `rarity`, `twoHanded`.
- Nenhum dos cinco é percentual no catálogo: a **normalização** vale 1 de fábrica e é configurável.
- Cajados/rods: o `wand.min/max` legado **não** entra no dano da ficha do jogo, então o fator `danoDoCajado` é 0 de fábrica (esses itens ficam "sem atributos base").
- Anéis e amuletos não têm nenhum dos cinco atributos base: IP 0 ("sem atributos base").
- Level recomendado: o catálogo não tem o campo; usa-se o `minLevel`.
- Presentes de marco (50 e 100): `gamedata/sets-de-marco.json` (baú de itens por classe: abre **um** item sorteado da lista).

## Fórmula (`systems/item-power.mjs`)
`IP = Σ atributo × normalização[atributo] × peso[atributo]`, com `Damage = (mín + máx) / 2`. Pesos de fábrica: Damage 1,0 · Block 1,5 · Armour 0,8 · Evasion 0,8 · Energy Shield 0,8 (0 a 100). `normalizacao.blockDaArma` = 0,5. Versão da fórmula (`versaoDaFormula`) fica registrada e muda o impacto mostrado na prévia.

## Curva de referência
Pontos `{level, ip}` de 1 a 1000 por categoria (= slot) com interpolação linear; fora dos pontos vale o da ponta. Sem curva própria, vale `curva.padrao`. Detecta **saltos abruptos** (inclinação > `saltoAbruptoFator` × mediana) e **quedas**. **Atenção:** a curva de fábrica é só um PONTO DE PARTIDA calculado da mediana do catálogo atual (monotônica; o catálogo só tem equipamento até o level 600, então 600–1000 repete o último valor). Ajuste no editor.

## Classificação
Diferença % = (IP − esperado) / esperado. Limites de fábrica: `< -25%` abaixo · até `+25%` adequado · até `+75%` acima · acima disso muito acima. Situações à parte: sem atributos base, sem level mínimo, sem referência. A classificação nunca altera atributos.

## Distribuição (`admin/item-power-analise.mjs`, só leitura)
- Hunts: level = o da campanha na dificuldade escolhida (ou o do cadastro); monstros pelos spawns do mapa; categoria do monstro = raridade do spawn; chance = bestiário × fator de drop da dificuldade.
- Alertas: item muito acima/abaixo do esperado para a hunt, level mínimo bem acima do level da hunt, item em muitas hunts, lacunas de poder entre itens da mesma faixa (slot × Ato).
- **Regras de distribuição** (planejamento no override): faixa de level, IP, raridade, slots, Ato, dificuldades, hunts, chefes e chance alvo. "Avaliar" lista os equipamentos que cabem e os drops atuais que fogem — não muda drop nenhum.

## Presentes de marco
IP por peça e por slot, total do conjunto (média por slot = o que o baú entrega em expectativa; "melhor escolha" = o melhor de cada slot) e classes que fogem da média do level além do limite de "acima do esperado". Não exige igualdade por atributo: as classes têm funções diferentes.

## Override e fluxo
`gamedata/item-power.json` (fábrica, nunca editada) + `gamedata/overrides/item-power.json` (só o diferente; histórico em `overrides/_versoes/item-power`). Editar → prévia (valida e mostra quem muda de situação) → salvar (com controle de revisão: conflito = 409) → Hot Reload local → aprovar versão/Git/merge/deploy manuais. Restaurar versão e voltar ao original na própria tela. Em produção a tela é somente leitura. Validação central: check `item-power`.

## Rotas (`/api/mapas/_conteudo/`)
GET `item-power`, `item-power/itens`, `item-power/item/<id>`, `item-power/curva/<slot>`, `item-power/marcos`, `item-power/alertas?dif=`, `item-power/hunts`, `item-power/hunt/<id>?dif=`, `item-power/versoes`; POST (leitura) `item-power/validar|simular|comparar|regra`; POST `item-power` (grava): `acao` = salvar | reverter | restaurar.

Testes: `testes/item-power.test.mjs`.

---

# Editor de nível e atributos-base (Item Power › Editar equipamento)

Sobre o módulo de comparação, o Item Power agora **edita** o nível e os atributos-base dos equipamentos existentes — **sem fonte de dados paralela**: usa a mesma camada de overrides do editor de Itens (`gamedata/overrides/itens.json`, `systems/overrides.mjs`), o mesmo histórico de versões, o mesmo controle de revisão e o Hot Reload `itens`. O catálogo importado (`item-catalog.json`) nunca é alterado.

## Diagnóstico: onde ficam os dados
- Cada equipamento é uma entrada de `gamedata/item-catalog.json` (id → `{ name, slot, type, minLevel, vocations, rarity, attack, defense, armor, weight, twoHanded, … }`), carregada em `ITEM_CATALOG` (`systems/dados.mjs`). Overrides de item aceitam só: `name, weight, buy, sell, attack, defense, armor, minLevel, rarity, imbuementSlots`.
- **Atributos-base ≠ modificadores:** `attack/defense/armor` são a base do catálogo; afixos/modificadores aleatórios, atributos adicionais, gemas e conjuntos vêm depois, no gerador (`itens/gerar.mjs`) e na ficha. Peças já geradas guardam a faixa sorteada (`p.base`).
- Mapa do Item Power para os campos reais: **Damage → `attack`**, **Block → `defense`**, e **Armour/Evasion/Energy Shield → todos derivados de `armor`** pelo tipo da base da peça (classe/peso) e pelo level do item (`personagem/atributos.mjs`: `tiposDaBase`, `valoresDaBase`). Eles NÃO existem como campos separados: editar um deles resolve a armadura-base que o produz (e mostra o resultado real). Um item só tem os tipos da sua base.
- **Somente leitura (com o motivo na tela):** categoria (slot), tipo, classe compatível e duas mãos — a camada de overrides não os suporta e mudá-los muda quem equipa e a base de defesa; **tier** é derivado do nível.

## Uso
- **Editar um equipamento:** aba Itens → escolher o item → **Editar equipamento**. Nome, nível, raridade, Damage, Block, armadura-base (ou um alvo de Armour/Evasion/Energy Shield). Cada atributo mostra original, atual (salvo), valor editado, resultado, diferença e **restaurar** individual. A prévia (IP atual × candidato, esperado, diferença, situação e equivalentes) atualiza ao editar; nada é gravado até **Salvar alterações**. **Aplicar alterações** salva e confirma a recarga (Hot Reload) agora. **Cancelar** descarta; **Restaurar valores originais** remove só os campos editáveis do override do item.
- **Edição rápida na tabela:** marque "edição rápida" na lista: nível, Damage, Block e armadura-base viram campos (originais em cinza, selo "modificado"); **Salvar alterações (n)** grava tudo numa operação.
- **Lote:** aba **Edição em lote**: filtros (classe, categoria, tier, Ato, nível, raridade, busca) + operações (definir / somar / multiplicar nível, Damage, Block, Armour, Evasion, Energy Shield) → prévia (quantidade, antes × depois, IP, ignorados com o motivo, alertas de excesso) → confirmação → gravação única (tudo ou nada). "Restaurar originais" desfaz os itens modificados.
- **Curva:** aba Curva › "Recalcular a curva com os dados atuais": proposta por **mediana** com descarte de valores atípicos e filtros; só vira curva se você usar a proposta e salvar o override.
- **Comparar:** aceita itens atuais, **originais** e versões **editadas ainda não salvas** (atalhos: original × editado, mesma classe e nível próximo, tier anterior/seguinte), com nível, classe, categoria, tier, raridade, atributos, IP e situação na curva.
- **Histórico:** cada gravação (individual, tabela, lote, restauração) fica em `database/dados/item-power-edicoes.jsonl` (local, fora do Git); versões do `itens.json` são comparáveis e restauráveis.

## Validação e alertas
Erros (bloqueiam): campo desconhecido/somente leitura, valor não numérico ou negativo, fora dos limites do override, item inexistente, raridade inválida, tipo de defesa que a peça não tem. **Alertas (não bloqueiam; exigem aprovação manual por alerta):** nível muito longe do original, IP muito acima/abaixo da curva, IP acima dos equivalentes, atributo fora da faixa do tier, alteração excessiva em lote.

## Hot Reload — o que realmente atualiza
Salvar grava `itens.json`; o Hot Reload `itens` (se ligado, só local) reaplica o catálogo **em memória**: Item Power, ficha e **próximos** drops passam a ler o valor novo. **Não** altera peças já geradas (mantêm a faixa sorteada), nem afirma que o combate "foi atualizado": só o que a ficha lê do catálogo muda. Com o Hot Reload desligado a Engine avisa que é preciso **reiniciar o ambiente local**.

Rotas novas: GET `item-power/edicao/<id>`, `historico`, `versoes-comparar`, `selecionar`; POST (leitura) `edicao-previa`, `lote-previa`, `curva-proposta` (e `comparar` com `entradas`); POST `item-power/edicao` (grava): `salvar | restaurar | restaurar-versao`. Testes: `testes/item-power-editor.test.mjs`.

---

# Editor de Itens — atributos-base, nível e Item Power no próprio editor

## Diagnóstico do que a tela mostrava errado
- **`nullnullnull` na pré-visualização:** causa raiz = `Element.replaceChildren(null)` NÃO ignora o `null`: escreve o **texto "null"**. A pré-visualização montava `[... ? el(...) : null, ... : null, ... : null]` e passava tudo ao `replaceChildren`, então cada ramo vazio virava a palavra "null". O `el()` do editor já ignorava null, o `replaceChildren` não. Correção: um guarda único em `editor-ui.mjs` (filtra null/undefined/false) que vale para TODAS as telas da Engine, mais o filtro explícito na pré-visualização.
- **Ataque/Defesa/Armadura vazios e original `—`:** o catálogo é esparso (arma sem `armor`, anel sem nada, escudo sem `attack`): o campo realmente **não existe** no item. A tela mostrava 3 campos fixos para qualquer item sem dizer isso, e nada de Armour/Evasion/Energy Shield (que são derivados, não campos). Agora a aba Combate mostra só o que se aplica ao slot, marca "ausente no original" (ausente ≠ 0) e mantém os não aplicáveis recolhidos.
- Formatadores (`fmt`, `fmtPct`, `fmtDif`) garantem que nenhum `null`, `undefined` ou `NaN` aparece na tela.

## O que existe na tela Itens — editar
- **Geral:** "Nível exigido" editável (original / salvo / simulado), tier da base e Act de referência (derivados), nível recomendado (= o nível; o catálogo não tem campo próprio) e o IP esperado para o nível, com alerta de nível longe do original.
- **Combate:** blocos *Atributos ofensivos* (Damage; mín. = máx. = `attack`), *Atributos defensivos* (Block = `defense`, armadura-base = `armor`, e Armour/Evasion/Energy Shield **derivados** — digitar um alvo resolve a armadura-base que o produz no tipo e nível da peça), outros campos do catálogo só para leitura (defesa extra, dano legado de cajado, elemento, proteções, duas mãos) e a lista do que NÃO é editado aqui (modificadores, bônus de conjunto, atributos do personagem). Cada atributo: original, atual (salvo), campo editável, simulado, diferença, % e restaurar individual.
- **Painel de Item Power:** IP original / atual / simulado, esperado, diferença absoluta e %, classificação, faixa "adequado", tabela original × salvo × simulado (nível, atributos, IP, situação), o que provocou a mudança, **composição do cálculo** (valor × fator × peso = pontos, com a configuração real), alertas de balanceamento, comparação com equivalentes e atalhos para o Item Power completo (comparar, lote, recalcular a curva). A curva **não** muda com a simulação.
- **Histórico:** campos com override salvo (restaurar só um campo), alterações registradas do item (editor de itens, Item Power, tabela, lote, restauração) e comparação com uma versão anterior do arquivo, filtrada pelo item.
- **Lista lateral:** nível, IP e selo "modificado" (com os originais); **edição rápida** (nível, Damage, Block, armadura-base) que grava pelo mesmo caminho do editor completo (`item-power/edicao`, uma gravação só), com confirmação e aprovação dos alertas.

## Salvar e Hot Reload
Salvar (editor completo ou rápido) grava `overrides/itens.json` pela mesma camada, com versão anterior, revisão contra conflito e registro no histórico, e pede `aplicar`: o servidor recarrega o catálogo em memória (Hot Reload `itens`) e devolve o resultado. O que atualiza: Item Power, ficha e **próximos** drops. Peças já geradas mantêm a faixa sorteada, e a tela só afirma o que de fato foi recarregado (com o Hot Reload desligado, avisa para reiniciar o ambiente local).

Rotas novas: POST `overrides/itens/poder` (painel, só leitura), POST `item-power/resolver-defesa`; `item-power/historico` e `versoes-comparar` aceitam `id`. Testes: `IPE21–IPE32` em `testes/item-power-editor.test.mjs`.
