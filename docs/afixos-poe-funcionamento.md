# Prefixos e sufixos que não funcionam (05/11/2026)

Pedido do dono: "verifique e faça uma relação dos itens que sufixos e prefixos não estão funcionando".

## Como foi verificado

- **As peças reais:** gerei peças de **todas as bases que caem** no jogo, 25 Mágicas e 25 Raras de cada, no Item Level 84, pelo mesmo caminho do drop (`gerarPeca` → `pecaDoJogo`). De cada prefixo e sufixo li o estado que o **balão** mostra. Ao todo foram ~152 mil prefixos e sufixos.
- **Os mapas:** gerei 3.000 mapas Raros T14–T16 e li o estado de cada linha, pelo caminho próprio dos mapas (`mapas.mjs`).
- **O catálogo inteiro:** passei também pelas 10.001 linhas de tier do catálogo, pelo tradutor. Esse caminho marca como "sem efeito" mods que funcionam por outro sistema (frascos, tinturas e mapas têm o seu), então o resultado que vale é o das peças reais.

## Resultado

### Sem efeito: 1, corrigido

| Item | Mod | O problema | Correção |
|---|---|---|---|
| Frasco de Vida e Frasco de Mana | sufixo **"do Antídoto"** (tier 1, Item Level 82) | Veio da coleção com o texto quebrado "Adiciona a de Dano de Raio" e sem número: não fazia nada | Agora é a imunidade a Envenenamento por **15–17 s**, como o poedb e o mesmo tier do Frasco Híbrido (`gamedata/itens-poe/afixos-correcoes.json`) |

As peças **já existentes** com esse sufixo quebrado continuam como estão, porque não mexo em itens de jogadores. Só as novas saem certas. Ele só cai em frasco de Item Level 82+, então deve haver pouquíssimas.

Depois da correção, nas peças reais:

| Estado no balão | Prefixos e sufixos |
|---|---|
| Equivalente (a mesma conta do PoE) | 95.357 |
| Novo (atributo do PoE, com efeito) | 49.834 |
| Aproximado (funciona, com diferença) | 7.300 |
| **Sem efeito / inerte** | **0** |

### Funcionam com diferença ("aproximado")

São 9 modelos. Todos têm efeito no combate, só não com a conta exata do PoE:

- Dano Físico aumentado em X% / +Y de Precisão
- +X de Evasão; +X de Armadura (o local da peça)
- os híbridos: Armadura/Vida, Armadura/Evasão, Evasão/Vida, Armadura/Escudo de Energia, Evasão/Escudo de Energia
- Velocidade de Ataque e Conjuração aumentada em X%

### Mapas: todos com efeito, 3 linhas parciais

| Linha | O que falta |
|---|---|
| Chefe Único tem sua Vida aumentada em X% / … Efeito em Área aumentado em Y% | A vida vale; o efeito em área do chefe ainda não existe no jogo |
| Precisão dos Monstros aumentada em X% / Jogadores têm Y% do Dano Mágico Suprimido Ignorado | A precisão vale; a supressão de dano mágico ainda não existe |
| Monstros raros têm espinhos elementais que refletem X de dano elemental | Vale; o PoE não diz a divisão, e no jogo é um terço de Fogo, Gelo e Raio |

### Fora do jogo (não caem)

Os mods de **Varas de Pesca** (pesca) e das **Bugigangas do Assalto/Heist** ("em Golpes", baús do Assalto, Insígnias do Renegado) estão no catálogo, mas essas classes não caem no jogo. Por isso não aparecem em peça nenhuma: 7 de pesca e 38 do Heist.

## Teste

`game/testes/itens-poe-afixos-correcoes.test.mjs`: o tier corrigido, e a varredura das peças que caem sem nenhum prefixo ou sufixo sem efeito.
