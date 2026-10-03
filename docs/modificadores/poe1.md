# Comparação com o Path of Exile 1

**Fonte consultada:** https://www.pathofexile.com/item-data/mods (página estática; o retorno mostrou a estrutura — prefixo/sufixo, coluna de nível, faixas de valor, tags — e estes exemplos reais: *Suffix of the Whelpling* (nível 1) `(6–11)% to Fire Resistance`; *Suffix of Tzteosh* (nível 84) `(46–48)% to Fire Resistance`; *Suffix of Skill* (nível 1) `(5–7)% increased Attack Speed`; *Suffix of Grandmastery* (nível 76) `(14–16)% increased Attack Speed`; *Prefix Redeemer's* (nível 73) `Adds (6–8) to (9–11) Physical Damage`). **Tudo o mais nesta página sobre o PoE é conhecimento geral do jogo, NÃO verificado na fonte nesta auditoria**, e está marcado como tal. Nenhum valor foi copiado para o Draevor.

## Diferenças de modelo
| Aspecto | PoE 1 | Draevor (verificado no código) |
|---|---|---|
| Prefixo/sufixo | Sim; limite por raridade (conhecimento geral: mágico 1+1, raro 3+3) | **Não existe**; N mods distintos por raridade (0 / 1–2 / 2–3 / 3–4 / 4–5 / 5–6) |
| Grupos de mod | Sim (impedem dois mods da mesma família) — conhecimento geral | **Não existe**; só "não repetir o mesmo id" |
| Convenção do tier | T1 = o melhor (conhecimento geral) | **T1 = o mais fraco, T5 = o mais forte** |
| Quantidade de tiers | Varia por mod (a página mostra vários níveis, ex.: resistência de fogo do nível 1 ao 84) | **Sempre 5** (tem T1–T5 mesmo `gem_level`, com faixas repetidas) |
| Liberação | Nível mínimo **por mod/tier** (coluna "Level" da página) | Item Level libera **faixas de tiers** (`tiers.json`) + `nivelMinimo` por mod (1, 20, 101, 301) |
| Faixas | Dois números (ex.: dano "Adds (6–8) to (9–11)") | Um intervalo `[mín, máx]` por tier; dano da arma vem da base, não de mod |
| Pesos | Peso por mod/tag (conhecimento geral) | Peso por mod (10–100) e peso por tier (100/60/30/12/4) com viés da raridade |
| Origens especiais (essência, fóssil, influência, corrupção, enchant) | Sim | Só a **essência** (item 900001, afixo único, a vermelha vale 130% da régua) e a forja (`rerrolar`); as demais não existem |

## Modificadores
- **Semelhantes nos dois:** vida, mana, armadura, evasão, Energy Shield, resistências (fogo, gelo, raio, físico), velocidade de ataque/conjuração, chance e multiplicador de crítico, precisão, roubo de vida/mana, regeneração, velocidade de movimento, bloqueio, bloqueio de magia, penetração, atributos (STR/DEX/INT), +nível de gemas, dano elemental %, dano físico %, recarga/custo de habilidade, rarity de itens (conhecimento geral para a parte do PoE).
- **Provavelmente só no Draevor (a confirmar no PoE):** `exp_bonus`, `gold_find`, `double_attack`, `control_resist`, `avoid_damage`, `dmg_reduction`, `dmg_vs_monsters`. `loot_bonus` lembra o "increased Rarity of Items found" do PoE (conhecimento geral).
- **Ausentes no Draevor (existem no PoE 1 — conhecimento geral, a confirmar na fonte antes de qualquer decisão):** dano de caos e resistência a caos, dano elemental/físico **somado em número** em todos os elementos, dano por tipo de arma/habilidade, dano de dano-ao-longo-do-tempo, chance de status (congelar, queimar, eletrocutar), reflexão, aura/redução de reserva, flasks, mods com condição ("enquanto…"), mods de minions, raridade e quantidade de itens separadas (no Draevor há só `loot_bonus`). Pertence à decisão de design (ver relatório, seção G); a lista não é um pedido.
- **Valores diferentes:** as faixas não são comparáveis diretamente (escalas de nível, de vida e de resistência diferentes; o teto de resistência do jogador é 75%, como o PoE). Ex.: resistência de fogo no PoE vai de 6–11% (nível 1) a 46–48% (nível 84) na página consultada; no Draevor, `fire_res` vai de 1,6–2,4% (T1) a 12,8–16% (T5) por mod — uma escala menor porque a soma vem de ~7 peças.
- **Regras diferentes:** no PoE o nível da peça libera mods individuais; aqui libera tiers para todos. O PoE tem tiers com larguras diferentes por mod; aqui todos têm 5.
- **Não diretamente comparáveis:** atributos próprios do Draevor (`gem_level` por raridade, `double_attack`, bônus de exp/ouro/loot).
