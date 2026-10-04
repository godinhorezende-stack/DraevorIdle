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
