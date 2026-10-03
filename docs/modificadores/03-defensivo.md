# Defensivos (11 modificadores)

> **Convenção do Draevor: T1 é o MAIS FRACO e T5 o MAIS FORTE** (o contrário do Path of Exile). Origem: `gamedata/itens/atributos.json`. Não existe prefixo/sufixo.

| Modificador (id) | Un. | T1 | T2 | T3 | T4 | T5 | Item Level mín. | Peso | Raridades |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Life (`life`) | número | 10–25 | 30–60 | 80–150 | 200–350 | 450–700 | 1 | 100 | todas |
| Mana (`mana`) | número | 10–25 | 30–60 | 80–150 | 200–350 | 450–700 | 1 | 80 | todas |
| Armour (`armor_flat`) | número | 1–2 | 3–4 | 5–7 | 8–11 | 11–14 | 1 | 70 | todas |
| Evasion (`evasion`) | número | 8–15 | 20–40 | 50–90 | 110–190 | 220–350 | 1 | 70 | todas |
| Energy Shield (`energy_shield`) | número | 8–15 | 20–40 | 50–90 | 110–190 | 220–350 | 1 | 70 | todas |
| Block Chance (`block`) | % | 1–1,5% | 2–2,5% | 3–4% | 4,5–6% | 6,5–8% | 1 | 30 | todas |
| Spell Block Chance (`spell_block`) | % | 0,5–1% | 1–2% | 2–3,5% | 3–5% | 4,5–7% | 1 | 20 | raro, épico, lendário, mítico |
| Control Resistance (`control_resist`) | % | 1,5–2,5% | 3–5% | 5,5–8% | 8,5–11% | 11,5–15% | 1 | 25 | raro, épico, lendário, mítico |
| Armour % (`armour_pct`) | % | 3–5% | 6–10% | 11–16% | 17–24% | 25–35% | 1 | 50 | todas |
| Evasion % (`evasion_pct`) | % | 3–5% | 6–10% | 11–16% | 17–24% | 25–35% | 1 | 50 | todas |
| Energy Shield % (`es_pct`) | % | 3–5% | 6–10% | 11–16% | 17–24% | 25–35% | 1 | 50 | todas |

## Detalhe por modificador

### Life — `life`
- Estado: ativo
- Tipo de valor: número fixo; Item Level mínimo para sair: 1; peso de sorteio: 100.
- Pools (equipamentos onde pode sair): escudo, livro, armadura, bota, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Mana — `mana`
- Estado: ativo
- Tipo de valor: número fixo; Item Level mínimo para sair: 1; peso de sorteio: 80.
- Pools (equipamentos onde pode sair): arma_magica, livro, armadura, bota, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Armour — `armor_flat`
- Estado: ativo
- Tipo de valor: número fixo; Item Level mínimo para sair: 1; peso de sorteio: 70.
- Pools (equipamentos onde pode sair): escudo, armadura, bota, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.
- ⚠ fronteira-compartilhada: o teto de T4 (11) é igual ao mínimo de T5: o valor 11 cabe nos dois

### Evasion — `evasion`
- Estado: ativo
- Tipo de valor: número fixo; Item Level mínimo para sair: 1; peso de sorteio: 70.
- Pools (equipamentos onde pode sair): escudo, armadura, bota, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Energy Shield — `energy_shield`
- Estado: ativo
- Tipo de valor: número fixo; Item Level mínimo para sair: 1; peso de sorteio: 70.
- Pools (equipamentos onde pode sair): escudo, livro, armadura, bota, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Block Chance — `block`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 1; peso de sorteio: 30.
- Pools (equipamentos onde pode sair): escudo, livro, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Spell Block Chance — `spell_block`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 1; peso de sorteio: 20.
- Pools (equipamentos onde pode sair): escudo, livro.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.
- ⚠ fronteira-compartilhada: o teto de T1 (1) é igual ao mínimo de T2: o valor 1 cabe nos dois
- ⚠ fronteira-compartilhada: o teto de T2 (2) é igual ao mínimo de T3: o valor 2 cabe nos dois
- ⚠ sobreposicao: T4 começa em 3, abaixo do teto de T3 (3.5)
- ⚠ sobreposicao: T5 começa em 4.5, abaixo do teto de T4 (5)

### Control Resistance — `control_resist`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 1; peso de sorteio: 25.
- Pools (equipamentos onde pode sair): escudo, armadura, bota, anel, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Armour % — `armour_pct`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 1; peso de sorteio: 50.
- Pools (equipamentos onde pode sair): escudo, armadura, bota, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Evasion % — `evasion_pct`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 1; peso de sorteio: 50.
- Pools (equipamentos onde pode sair): escudo, armadura, bota, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.

### Energy Shield % — `es_pct`
- Estado: ativo
- Tipo de valor: percentual (%); Item Level mínimo para sair: 1; peso de sorteio: 50.
- Pools (equipamentos onde pode sair): escudo, livro, armadura, bota, amuleto.
- Tier liberado a partir do Item Level: T1≥1, T2≥1, T3≥101, T4≥601, T5≥1201.
