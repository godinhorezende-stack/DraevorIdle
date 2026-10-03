# Modificadores LEGADOS (não caem mais)

Vêm de `atributos.json > legado`. Peças antigas que os trazem são convertidas ao carregar (`renomearAdds`, em `systems/itens/item.mjs`, tabela `ADD_NOVO_DO_ANTIGO`). Estão no catálogo derivado `FICHAS` (73 = 55 ativos + 18 legados) só para a conversão e a tela de peças antigas.

| Legado | Tipo | T1 | T2 | T3 | T4 | T5 | Vira |
|---|---|---:|---:|---:|---:|---:|---|
| Onslaught (`onslaught`) | pct | 0,4–0,6% | 0,8–1,2% | 1,4–2% | 2,2–3% | 3,2–4% | `crit_dmg` |
| Dano Mágico (`spell_dmg`) | pct | 0,7–1,05% | 1,4–2,1% | 2,45–3,5% | 3,85–5,25% | 5,6–7% | `int` |
| Cura Mágica (`spell_heal`) | pct | 0,7–1,05% | 1,4–2,1% | 2,45–3,5% | 3,85–5,25% | 5,6–7% | `int` |
| Vida % (`hp_max`) | pct | 1,2–1,8% | 2,4–3,6% | 4,2–6% | 6,6–9% | 9,6–12% | `life` |
| Mana % (`mana_max`) | pct | 1,2–1,8% | 2,4–3,6% | 4,2–6% | 6,6–9% | 9,6–12% | `mana` |
| Regeneração de Vida (`hp_regen`) | flat | 1–2 | 3–4 | 5–7 | 8–11 | 11–14 | `life_regen` |
| Capacidade (`capacity`) | flat | 14–21 | 28–42 | 49–70 | 77–105 | 112–140 | `str` |
| Movimento (`speed`) | flat | 1–2 | 2–4 | 4–6 | 7–9 | 10–12 | `move_speed` |
| Proteção contra Tudo (`protect_all`) | pct | 0,2–0,3% | 0,4–0,6% | 0,7–1% | 1,1–1,5% | 1,6–2% | `phys_res` |
| ATK % (`weapon_atk_pct`) | pct | 1–1,5% | 2–3% | 3,5–5% | 5,5–7,5% | 8–10% | `phys_dmg` |
| Skill Melee (`skill_melee`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `str` |
| Skill Melee (`skill_fist`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `str` |
| Skill Melee (`skill_club`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `str` |
| Skill Melee (`skill_sword`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `str` |
| Skill Melee (`skill_axe`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `str` |
| Distance Fighting (`skill_distance`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `dex` |
| Magic Level (`skill_magic`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `int` |
| Shielding (`skill_shielding`) | flat | 1 | 1–2 | 2–3 | 3–5 | 5–6 | `block` |