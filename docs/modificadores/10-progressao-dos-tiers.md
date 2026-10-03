# Progressão dos tiers e liberação por Item Level

## Quais tiers cada Item Level libera (`tiers.json`)

| Item Level | Tiers possíveis |
|---|---|
| 1–100 | T1, T2 |
| 101–600 | T1, T2, T3 |
| 601–1200 | T1, T2, T3, T4 |
| 1201–∞ | T1, T2, T3, T4, T5 |

Peso de cada tier: T1=100, T2=60, T3=30, T4=12, T5=4. Viés da raridade (multiplica o peso de cada tier por viés^(tier−1)): comum=1, incomum=1.1, raro=1.3, épico=1.6, lendário=2, mítico=2.5; amuleto ×1.2; boss +10% no Item Level.

## Quantos mods cada raridade tem (`raridades.json`)

| Raridade | Quantidade de mods (chance %) |
|---|---|
| comum | 0 (100%) |
| incomum | 1 (50%), 2 (50%) |
| raro | 2 (50%), 3 (50%) |
| épico | 3 (50%), 4 (50%) |
| lendário | 4 (50%), 5 (50%) |
| mítico | 5 (50%), 6 (50%) |

## Achados de progressão

- `phys_pen` — **fronteira-compartilhada**: o teto de T4 (4) é igual ao mínimo de T5: o valor 4 cabe nos dois
- `elem_pen` — **fronteira-compartilhada**: o teto de T4 (4) é igual ao mínimo de T5: o valor 4 cabe nos dois
- `double_attack` — **fronteira-compartilhada**: o teto de T4 (4) é igual ao mínimo de T5: o valor 4 cabe nos dois
- `armor_flat` — **fronteira-compartilhada**: o teto de T4 (11) é igual ao mínimo de T5: o valor 11 cabe nos dois
- `spell_block` — **fronteira-compartilhada**: o teto de T1 (1) é igual ao mínimo de T2: o valor 1 cabe nos dois
- `spell_block` — **fronteira-compartilhada**: o teto de T2 (2) é igual ao mínimo de T3: o valor 2 cabe nos dois
- `spell_block` — **sobreposicao**: T4 começa em 3, abaixo do teto de T3 (3.5)
- `spell_block` — **sobreposicao**: T5 começa em 4.5, abaixo do teto de T4 (5)
- `gem_level` — **fronteira-compartilhada**: o teto de T1 (1) é igual ao mínimo de T2: o valor 1 cabe nos dois
- `gem_level` — **tiers-identicos**: T1 e T2 têm a mesma faixa (1–1)
- `gem_level` — **fronteira-compartilhada**: o teto de T2 (1) é igual ao mínimo de T3: o valor 1 cabe nos dois
- `gem_level` — **tiers-identicos**: T2 e T3 têm a mesma faixa (1–1)
- `gem_level` — **fronteira-compartilhada**: o teto de T4 (2) é igual ao mínimo de T5: o valor 2 cabe nos dois
- `gem_level` — **tiers-identicos**: T4 e T5 têm a mesma faixa (2–2)