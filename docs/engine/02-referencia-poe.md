# Engine do Draevor — Fase B: a coleção de referência do PoE (04/10/2026)

Fonte: a pasta pública do Google Drive indicada pelo dono (`1LoV-Y3F3398tXymGTZjl8S5M8HnaFsK0`).
**Acesso: conseguido** (pasta pública, lida pela listagem do Drive, sem login). Inventário completo da árvore e cópia local de
todos os arquivos em `/home/deploy/referencias-poe/original` — **fora do repositório, fora do deploy e não servida pelo jogo**.
Este documento só registra estrutura, contagens e fontes; nenhum conteúdo da coleção foi copiado para o Draevor.

## 1. Inventário

- **233 pastas, 3.061 arquivos**: 2.349 PNG, 342 Markdown, 322 JSON, 34 SVG, 10 CSV, 2 HTML, 1 JS, 1 TXT.
- Texto baixado: 677 de 678. Falhou `poe-apresentacao/mobdata.js` (arquivo grande: o Drive pede confirmação de antivírus;
  dá para baixar manualmente se for necessário).
- Imagens: ícones de item em **64×64** (o README diz que foram convertidos para "estilo Tibia"), ícones de gema em **78×78**,
  SVG de diagramas. O catálogo completo (formato, dimensões, tamanho, SHA-1, origem) fica em
  `/home/deploy/referencias-poe/catalogo-imagens.json`.
- Nomes repetidos (39) são estruturais (um `ascendencia.md` por ascendência, um `ato.json` por ato), não duplicatas. Duplicatas
  de conteúdo são apontadas pelo SHA-1 do catálogo.

## 2. Classificação (pasta → categorias do pedido)

| Pasta | Conteúdo | Fontes declaradas | Categorias |
|---|---|---|---|
| `poe-itens` (2.057 PNG, 238 JSON, 177 MD) | 47 categorias de item no formato do PoEDB: `bases`, `unicos`, `atributos-bases/unicos` (dano, crítico, armadura, requisitos), `modificadores` e **`modificadores-tiers`** (família, prefixo/sufixo, T1..Tn, iLvl, peso, % no pool), `sintese-implicitos`; mapas, moedas, frascos, joias, raridades | poedb.tw | Item Bases, Item Modifiers, Prefixes, Suffixes, Implicits, Item Rarity, Item Level, Equipment, Maps, Crafting (moedas) |
| `poe-gems` (292 PNG) | Lista de skill gems por cor com nível e ícone | poewiki.net | Active Gems / Skills (só nome, cor, nível) |
| `poe-arvore` (37 MD, 26 JSON, 23 SVG, 4 CSV) | 7 classes, 21 ascendências (411 nós), árvore principal (2.429 nós, 2.419 ligações), notáveis, keystones | poedb.tw | Character Classes, Character Attributes, Progression |
| `poe-atos` (94 MD, 40 JSON, 11 SVG) | 10 atos + epílogo: áreas, níveis, monstros (XP, dano, vida, resistências), missões, mapas e grafos, chefes, NPCs | poedb.tw, Wiki/Fandom | Acts, Maps, Bosses, Progression, Monsters |
| `poe-monstros` (9 MD, 7 JSON, 3 CSV) | 1.935 variedades de monstro (Dano%, Vida%), **status base por nível 1–100**, 501 mods de monstro, padrões, raridade | poedb.tw | Monsters, Monster Modifiers |
| `poe-bestiario` (24 MD, 11 JSON) | Bestiary league: 387 criaturas, base por nível 1–90, lendárias, receitas | poedb.tw | Monsters, Crafting |
| `poe-apresentacao` (2 HTML) | Páginas de apresentação do que foi extraído e um teste de simulação | — | (índice) |

## 3. Relevância para os sistemas do Draevor

| Sistema do Draevor | Documentos mais úteis | Uso esperado |
|---|---|---|
| Modificadores de item (`itens/atributos.json`, `pools`, `tiers`) | `poe-itens/**/modificadores-tiers.json` | Comparar modelo (famílias, prefixo/sufixo, tiers por iLvl, pesos); **piloto recomendado** |
| Bases de item (`item-catalog.json`) | `poe-itens/**/atributos-bases.json`, `sintese-implicitos` | Implícitos, faixas de dano/defesa por base |
| Monstros (`mobs/*.json`, escala por nível) | `poe-monstros/Base_por_Nivel`, `Mods_e_Padroes` | Curvas de vida/dano/XP por nível, mods de raridade |
| Classes e passivas (`classes.json`, `passivas/`) | `poe-arvore/**` | Atributos iniciais, estrutura da árvore e das ascendências |
| Atos e mundo (`campanha.json`) | `poe-atos/**` | Faixas de nível por ato, estrutura de áreas e chefes |
| Gemas (`gemas/*.json`) | `poe-gems` | Só nomes e níveis (ver lacunas) |

## 4. Lacunas da coleção

- **Quase não há regras de cálculo**: os temas de mecânica (acerto, evasão, armadura, bloqueio, energy shield, penetração, crítico,
  ailments, auras, qualidade) aparecem como **nomes de atributo nas tabelas de dados**, não como explicação da mecânica. Só 16
  documentos citam "fórmula", de passagem; taxa de drop aparece em 1. A ordem de cálculo do dano, as fórmulas de armadura/acerto e
  as regras de drop **não estão documentadas** na coleção (o Draevor já tem essas fórmulas, escritas a partir de conhecimento geral
  do PoE e marcadas como tal em `formulas.json`).
- **Gemas**: só nome, cor, nível e ícone — sem os números por nível, as tags nem as regras de suporte.
- **Imagens**: só ícones de item (bases e únicos), de gema e diagramas SVG. Sem imagens das armas de duas mãos exceto cajados (arcos,
  machados, maças, espadas de duas mãos e cajados de guerra não têm ícone), **sem sprites de monstro, tileset, efeito, projétil ou
  interface**.
- Itens: os textos dos únicos e os nomes de mods estão traduzidos/extraídos do PoEDB — são texto de terceiros.

## 5. Direitos de uso

As imagens e os textos são do Path of Exile (Grinding Gear Games), extraídos do PoEDB e da PoE Wiki. Servem como **referência de
estudo e material de teste local**; não há autorização de redistribuição registrada. Por isso: ficam fora do repositório, não são
servidos pela produção e não devem ser associados a entidades publicadas do jogo. Mecânicas e números servem de comparação; a
adaptação para o Draevor é sempre nossa (nomes, valores e arte próprios).
