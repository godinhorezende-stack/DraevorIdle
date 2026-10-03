# Compatibilidade modificador × equipamento

Controlada **só por código + dados**: o tipo do item (`tipoDoItem`, em `gerar.mjs`, pelo slot/skill/flags do catálogo) escolhe o pool de `pools.json`; depois `poolDe` filtra por `dropa`, Item Level mínimo, raridade e, fora anel/amuleto, os adds de defesa que a base da peça não tem (`DEFESA_DO_ADD`). Não há tags nem grupos no banco.

Tipos de item com pool: `arma_melee`, `arma_distancia`, `arma_magica`, `municao`, `escudo`, `livro`, `aljava`, `armadura`, `bota`, `anel`, `amuleto`.

| Modificador | Armas (melee/dist/mágica/munição) | Escudos (escudo/livro/aljava) | Armaduras (armadura/bota) | Anéis | Amuletos |
|---|---|---|---|---|---|
| STR (`str`) | arma_melee, arma_distancia | escudo | todos | todos | todos |
| DEX (`dex`) | arma_melee, arma_distancia, municao | escudo, aljava | todos | todos | todos |
| INT (`int`) | arma_magica | escudo, livro | todos | todos | todos |
| Attack (`atk_flat`) | — | — | — | — | — |
| Dano adicional (`phys_add`) | arma_melee, arma_distancia, municao | aljava | — | todos | todos |
| Physical Damage (`phys_dmg`) | arma_melee, arma_distancia, municao | escudo, aljava | armadura | todos | todos |
| Fire Damage (`fire_dmg`) | todos | livro, aljava | armadura | todos | todos |
| Earth Damage (`earth_dmg`) | todos | livro, aljava | armadura | todos | todos |
| Energy Damage (`energy_dmg`) | todos | livro, aljava | armadura | todos | todos |
| Ice Damage (`ice_dmg`) | todos | livro, aljava | armadura | todos | todos |
| Holy Damage (`holy_dmg`) | todos | livro, aljava | armadura | todos | todos |
| Death Damage (`death_dmg`) | todos | livro, aljava | armadura | todos | todos |
| Attack Speed (`atk_speed`) | arma_melee, arma_distancia | aljava | todos | todos | todos |
| Cast Speed (`cast_speed`) | arma_magica | livro | todos | todos | todos |
| Critical Chance (`crit_chance`) | todos | aljava | armadura | todos | todos |
| Critical Damage (`crit_dmg`) | todos | aljava | — | todos | todos |
| Physical Penetration (`phys_pen`) | arma_melee, arma_distancia | — | — | todos | todos |
| Elemental Penetration (`elem_pen`) | arma_melee, arma_distancia, arma_magica | — | — | todos | todos |
| Double Attack (`double_attack`) | arma_melee, arma_distancia, arma_magica | — | bota | — | — |
| Accuracy (`accuracy`) | todos | aljava | — | todos | todos |
| Life Leech (`life_leech`) | arma_melee, arma_distancia, arma_magica | — | — | todos | todos |
| Mana Leech (`mana_leech`) | arma_melee, arma_distancia, arma_magica | — | — | todos | todos |
| Life (`life`) | — | escudo, livro | todos | todos | todos |
| Mana (`mana`) | arma_magica | livro | todos | todos | todos |
| Armour (`armor_flat`) | — | escudo | todos | — | todos |
| Evasion (`evasion`) | — | escudo | todos | todos | todos |
| Energy Shield (`energy_shield`) | — | escudo, livro | todos | todos | todos |
| Block Chance (`block`) | — | escudo, livro | — | — | todos |
| Spell Block Chance (`spell_block`) | — | escudo, livro | — | — | — |
| Control Resistance (`control_resist`) | — | escudo | todos | todos | todos |
| Physical Resistance (`phys_res`) | — | escudo, livro | todos | todos | todos |
| Fire Resistance (`fire_res`) | — | escudo, livro | todos | todos | todos |
| Earth Resistance (`earth_res`) | — | escudo, livro | todos | todos | todos |
| Energy Resistance (`energy_res`) | — | escudo, livro | todos | todos | todos |
| Ice Resistance (`ice_res`) | — | escudo, livro | todos | todos | todos |
| Holy Resistance (`holy_res`) | — | escudo, livro | todos | todos | todos |
| Death Resistance (`death_res`) | — | escudo, livro | todos | todos | todos |
| Movement Speed (`move_speed`) | — | — | bota | todos | todos |
| Experience (`exp_bonus`) | — | — | — | todos | todos |
| Gold Find (`gold_find`) | — | — | — | todos | todos |
| Loot Rate (`loot_bonus`) | — | — | — | todos | todos |
| Life Regeneration (`life_regen`) | — | escudo, livro | todos | todos | todos |
| Mana Regeneration (`mana_regen`) | — | escudo, livro | todos | todos | todos |
| Life Regeneration % (`life_regen_pct`) | — | escudo, livro | todos | todos | todos |
| Mana Regeneration % (`mana_regen_pct`) | — | escudo, livro | todos | todos | todos |
| Armour % (`armour_pct`) | — | escudo | todos | — | todos |
| Evasion % (`evasion_pct`) | — | escudo | todos | — | todos |
| Energy Shield % (`es_pct`) | — | escudo, livro | todos | — | todos |
| Damage vs Boss (`dmg_vs_boss`) | todos | — | — | todos | todos |
| Damage vs Elite (`dmg_vs_elite`) | todos | — | — | todos | todos |
| Damage vs Monsters (`dmg_vs_monsters`) | todos | — | — | todos | todos |
| Damage Reduction (`dmg_reduction`) | — | escudo | armadura | — | todos |
| Cooldown Recovery (`cooldown_recovery`) | arma_magica | livro | armadura | todos | todos |
| Skill Cost Reduction (`skill_cost`) | arma_magica | livro | armadura | todos | todos |
| Chance to Avoid Damage (`avoid_damage`) | — | escudo | armadura | — | todos |
| Nível das gemas encaixadas (`gem_level`) | arma_melee, arma_distancia, arma_magica | escudo, livro | todos | todos | todos |

## Regras de defesa da base
Só saem `armor_flat`/`armour_pct` se a base da peça tem armadura, `evasion`/`evasion_pct` se tem evasão, `energy_shield`/`es_pct` se tem Energy Shield (anel e amuleto são livres). Equipamentos sem pool (mochila, itens que empilham) não recebem mod.