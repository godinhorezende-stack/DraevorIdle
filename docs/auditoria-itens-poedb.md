# Auditoria dos itens do poedb (04/11/2026)

Fonte: https://poedb.tw/pt/Items. As 86 páginas de classe e as 2674 páginas de item foram baixadas pelo Scrapling (`/home/deploy/scrapling/saida`), sem nenhuma falha. Das páginas de classe saíram 10.234 cards de item (`extrair/itens_lista.py` → `saida/itens/lista.json`).

Cada card foi cruzado com os dados do jogo (`game/gamedata/itens-poe/*.json`) por slug e por nome em português. Depois, as linhas do balão (requisitos, propriedades, implícitos, explícitos e efeitos) foram comparadas com as do card. A lista completa do que falta, por página do poedb, está em [auditoria-itens-poedb-faltam.json](auditoria-itens-poedb-faltam.json).

Ficaram de fora da conta as entradas que não são itens:
- as abas "Acronym" (links relacionados);
- `[DNT - UNUSED]`;
- as cartas desativadas;
- as passivas das Joias Atemporais;
- os modificadores da Árvore do Atlas.

## 1. O que está no jogo

| Grupo | No jogo | Observação |
|---|---|---|
| Bases de equipamento, armas, frascos, tinturas e joias (32 classes) | completas, menos 5 | faltam os **4 Frascos Híbridos** (Pequeno, Médio, Colossal, Sagrado) |
| Únicos (`Unique_item`) | 1528 de 1534 | faltam **Jack, o Machado**; os 5 "Contratos" únicos são do Heist (ver §2) |
| Únicos Réplica | 93 de 102 | faltam 9 Réplicas: Sacrifício de Sangue, Construção Barata, Eficiência do Conquistador, Shako Proibido, Florescer Frágil, Cabeça Quente, Talento Puro, Ladrão de Almas, Carga Instável |
| Joias Ramificadoras | 320 de 321 | falta o único **Filho da Violência** |
| Foulborn | 304 de 313 cards | os 9 que sobram são links relacionados, não itens |
| Gemas de habilidade | 563 de 563 | completas |
| Gemas de suporte | 257 de 262 | os 4 da página de Varas de Pesca (Salvaguarda, Edificar, Magnetismo, Afluência Assustadora) não estão na lista do jogo |
| Moedas empilháveis básicas | todas, menos o **Ducado de Ukatoa** | |
| Mapas | os 26 únicos e o mapa base | |
| Astrolábios, Bases Experimentais, Excepcionais | completos | |
| Peças (de únicos) | 16 de 22 | faltam 6 peças: Escudo Triangular do Arconte, Espada da Legião, Cajado Imperial, Cinto de Pano, Aljava de Flechas Cegas, Máscara Insensível |

## 2. O que não está no jogo (conteúdo de liga e outros)

| Página do poedb | Faltam | Conteúdo |
|---|---|---|
| Hideout_Doodads | 1649 | decoração de esconderijo |
| Divination_Cards | 458 | cartas de adivinhação |
| Map_Fragments | 197 | fragmentos (Sacrifícios, Mortais, Chaves da Corte Pálida, Guardiões, Atziri, Uber…) |
| Scarab | 118 | escaravelhos |
| Corpses | ~114 | cadáveres (Necropolis) |
| Essence | 110 | essências |
| Hideout | 102 | esconderijos |
| Contracts e Blueprints | 48 + 9 | Heist (os contratos, inclusive os 5 únicos) |
| Runegraft | 32 | Enxertos de Runa |
| Fossil e Resonator | 29 + 4 | Delve |
| Incubators | 27 | incubadores |
| Delirium_Orb | 16 | orbes delirantes |
| Misc_Map_Items | 17 | convites da Maven, Crônica de Atzoatl, Ultimato, Tábua Espelhada |
| Splinter, Breachstone, Blessing | 13 + 10 + 5 | Fenda e Lascas Atemporais |
| Catalysts | 13 | catalisadores |
| Vial | 9 | frascos da Incursão |
| Emblem | 5 | Emblemas Atemporais (Lendários) |
| Stackable_Currency (sub-abas) | ~290 | óleos (16), presságios (12), invocações de Lycia (41), relatórios de batedor (9) e as moedas de liga acima |
| Expedition_Logbooks | 1 | diário da Expedição |

## 3. Balão: dados do jogo × poedb

| Grupo | Conferidos | Diferenças reais |
|---|---|---|
| Bases (requisitos, propriedades, implícitos) | 1079 | **0**. A única sobra é a Lâmina de Energia, com o implícito "Adiciona a de Dano de Raio" sem números, mas o poedb mostra a mesma linha, porque o valor vem da gema Lâmina da Tempestade. As 17 bases sem card são as variantes `_2…_6` dos talismãs e do Anel de Duas Pedras. |
| Únicos (implícitos e explícitos) | 1225 | **0 de texto**. Sobram só marcas: "Histórico" nas 11 Joias Atemporais (só no poedb), "Não Modificável" nas 39 Relíquias e nos únicos do Santuário (o jogo mostra e o card do poedb não) e o Emblema do Precursor, cujo card do poedb tem uma linha em inglês ("+20 to Intelligence"). |
| Moedas (efeito e tamanho da pilha) | 195 | **0**. O único aviso é falso: o slug "Pearls_Before_Swine" também é de uma carta de adivinhação. |

O que o PoE mostra no balão e o jogo **não** mostra:

1. **"Corrompido"**: a peça corrompida tem `corrompido: true` (`systems/itens-poe/moedas.mjs`) e a Forja mostra a marca, mas o balão (`frontend/client/src/itens-poe-balao.mjs`) não tem a linha vermelha "Corrompido". Além disso, nenhum dos únicos que o poedb marca como "já vêm corrompidos" (51, mais 37 joias e 4 amuletos) tem essa marca nos dados.
2. **Texto de sabor (flavour)**: 2108 páginas de item do poedb trazem o texto de sabor em itálico (por exemplo, a Vergôntea: "Das menores sementes / Até as maiores sequoias…"). Ele não está nos dados nem no balão.
3. **"Histórico"**: a marca das Joias Atemporais, que não aparece no balão.
4. **Linhas internas do poedb**: o poedb mostra stats internos em inglês com valor entre colchetes, como "local six linked sockets [1]". O PoE não mostra essas linhas e o jogo também não, o que está certo.

As gemas não entraram nesta comparação: o balão delas é o `balao-da-gema.mjs`, que já foi auditado à parte (`docs/gemas-poe-progresso.md`).

## 4. Decisões do dono

- **A.** Entram os itens que faltam e não são de liga? São 4 Frascos Híbridos, Jack o Machado, 9 Réplicas, o Filho da Violência, 6 Peças, o Ducado de Ukatoa e 4 suportes.
- **B.** Entra algum conteúdo de liga (§2)? As maiores fatias são as cartas de adivinhação, as essências, os fragmentos e os escaravelhos.
- **C.** O balão ganha a linha "Corrompido", o texto de sabor e a marca "Histórico"? E os únicos que já vêm corrompidos passam a vir com a marca?
- **D.** Os doodads e os esconderijos (1751 cards) entram na auditoria? Hoje eles só foram listados.

## 5. O que foi feito (04/11, decisões do dono)

- **Entraram:**
  - **Frascos Híbridos:** a linha inteira de 6 (Pequeno 10, Médio 20, Grande 30, Colossal 40, Sagrado 50, Consagrado 60). Recuperam Vida e Mana no mesmo uso.
  - **Réplicas:** as 9 que faltavam.
  - **Filho da Violência.**
  - **Jack, o Machado:** já estava no jogo. O falso alarme veio do slug com vírgula.
- **Balão:**
  - linha "Corrompido";
  - texto de sabor (`gamedata/itens-poe/sabores.json`, gerado por `game/tools/importar-sabores-poedb.mjs`);
  - "Histórico";
  - os 51 únicos e as 2 bases que o PoE dá corrompidos caem corrompidos.
- **Ficaram fora, por decisão do dono:**
  - **Ducado de Ukatoa:** o jogo não tem os mods sobrenaturais de amuleto.
  - **Os 4 "suportes" das Varas de Pesca:** são gemas de teste do PoE ("[DNT] Supports bla").
  - **As 6 Peças do Harbinger:** os dados não dizem qual único cada conjunto forma.
- **Ícones (baixados com o aval do dono, 04/11):**
  - Os 6 Híbridos estão na coleção, em `poe-itens/Frascos/Hybrid_Flasks/icones/`, e o importador liga cada um à sua base.
  - Os 11 únicos que a coleção não tinha estão em `icones-itens/poe-itens/Unicos_poedb/`, ligados em `catalogo.mjs`. São as 9 Réplicas, o Filho da Violência e a Réplica do Ensinamento de Maata, que já estava sem ícone.
  - Todos vieram do CDN do poedb, menos o do Filho da Violência: o poedb recusa essa imagem (403), e a mesma arte veio do CDN oficial do PoE (`web.poecdn.com`, `PitfighterJewel.png`).
  - O formato é o da coleção: PNG 64×64, centralizado e transparente.
  - Agora todas as 1085 bases e todos os 1645 únicos têm ícone.
