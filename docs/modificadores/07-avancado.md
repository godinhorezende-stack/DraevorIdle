# Avançados (nível alto) (8 modificadores)

> **Convenção do Draevor: T1 é o MAIS FRACO e T5 o MAIS FORTE** (o contrário do Path of Exile). Origem: `gamedata/itens/atributos.json`. Não existe prefixo/sufixo.

| Modificador (id) | Un. | T1 | T2 | T3 | T4 | T5 | Item Level mín. | Peso | Raridades |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Damage vs Boss (`dmg_vs_boss`) | % | 2–4% | 5–8% | 9–13% | 14–19% | 20–26% | 101 | 25 | raro, épico, lendário, mítico |
| Damage vs Elite (`dmg_vs_elite`) | % | 2–4% | 5–8% | 9–13% | 14–19% | 20–26% | 101 | 25 | raro, épico, lendário, mítico |
| Damage vs Monsters (`dmg_vs_monsters`) | % | 2–4% | 5–8% | 9–13% | 14–19% | 20–26% | 101 | 30 | raro, épico, lendário, mítico |
| Damage Reduction (`dmg_reduction`) | % | 1–1,5% | 2–2,5% | 3–4% | 4,5–5,5% | 6–8% | 301 | 15 | épico, lendário, mítico |
| Cooldown Recovery (`cooldown_recovery`) | % | 2–3% | 4–6% | 7–10% | 11–14% | 15–18% | 101 | 20 | raro, épico, lendário, mítico |
| Skill Cost Reduction (`skill_cost`) | % | 2–3% | 4–6% | 7–10% | 11–14% | 15–18% | 101 | 20 | raro, épico, lendário, mítico |
| Chance to Avoid Damage (`avoid_damage`) | % | 0,5–1% | 1,5–2% | 2,5–3% | 3,5–4,5% | 5–6% | 301 | 10 | épico, lendário, mítico |
| Nível das gemas encaixadas (`gem_level`) | número | 1 | 1 | 1 | 2 | 2 | 20 | 12 | incomum, raro, épico, lendário, mítico |

## Detalhe por modificador

### Damage vs Boss — `dmg_vs_boss`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 101; peso de sorteio: 25.
- Pools (equipamentos onde pode sair): arma_melee, arma_distancia, arma_magica, municao, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥101, T2≥101, T3≥101, T4≥601, T5≥1201.

### Damage vs Elite — `dmg_vs_elite`
- Estado: cadastrado e DESLIGADO do drop (dropa:false)
- Tipo de valor: percentual (%); Item Level mínimo para sair: 101; peso de sorteio: 25.
- Pools (equipamentos onde pode sair): arma_melee, arma_distancia, arma_magica, municao, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥101, T2≥101, T3≥101, T4≥601, T5≥1201.

### Damage vs Monsters — `dmg_vs_monsters`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 101; peso de sorteio: 30.
- Pools (equipamentos onde pode sair): arma_melee, arma_distancia, arma_magica, municao, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥101, T2≥101, T3≥101, T4≥601, T5≥1201.

### Damage Reduction — `dmg_reduction`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 301; peso de sorteio: 15.
- Pools (equipamentos onde pode sair): escudo, armadura, amuleto.
- Tier liberado a partir do Item Level: T1≥301, T2≥301, T3≥301, T4≥601, T5≥1201.

### Cooldown Recovery — `cooldown_recovery`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 101; peso de sorteio: 20.
- Pools (equipamentos onde pode sair): arma_magica, livro, armadura, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥101, T2≥101, T3≥101, T4≥601, T5≥1201.

### Skill Cost Reduction — `skill_cost`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 101; peso de sorteio: 20.
- Pools (equipamentos onde pode sair): arma_magica, livro, armadura, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥101, T2≥101, T3≥101, T4≥601, T5≥1201.

### Chance to Avoid Damage — `avoid_damage`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 301; peso de sorteio: 10.
- Pools (equipamentos onde pode sair): escudo, armadura, amuleto.
- Tier liberado a partir do Item Level: T1≥301, T2≥301, T3≥301, T4≥601, T5≥1201.

### Nível das gemas encaixadas — `gem_level`
- Estado: ativo
- Tipo de valor: número fixo; Item Level mínimo para sair: 20; peso de sorteio: 12.
- Pools (equipamentos onde pode sair): arma_melee, arma_distancia, arma_magica, escudo, livro, armadura, bota, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥20, T2≥20, T3≥101, T4≥601, T5≥1201.
- Valor fixo por raridade: {"incomum":1,"raro":1,"épico":2,"lendário":2,"mítico":2}.
- ⚠ fronteira-compartilhada: o teto de T1 (1) é igual ao mínimo de T2: o valor 1 cabe nos dois
- ⚠ tiers-identicos: T1 e T2 têm a mesma faixa (1–1)
- ⚠ fronteira-compartilhada: o teto de T2 (1) é igual ao mínimo de T3: o valor 1 cabe nos dois
- ⚠ tiers-identicos: T2 e T3 têm a mesma faixa (1–1)
- ⚠ fronteira-compartilhada: o teto de T4 (2) é igual ao mínimo de T5: o valor 2 cabe nos dois
- ⚠ tiers-identicos: T4 e T5 têm a mesma faixa (2–2)
- ⚠ valor-por-raridade: o valor sorteado vem da RARIDADE ({"incomum":1,"raro":1,"épico":2,"lendário":2,"mítico":2}), não do tier: as faixas por tier só informam
