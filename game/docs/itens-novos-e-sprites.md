# Criar itens e mobs, sprite de item e atalhos de edição da Biblioteca

Tudo por **overrides** (os originais do Canary nunca mudam), com validação central, Hot Reload local, histórico/versões e o fluxo manual commit → deploy.

## Criar itens (duplicando)
- Editor de Itens › **Criar item novo (duplicar)** (ou, na Biblioteca, **Criar item novo a partir deste**): nasce uma entrada em `gamedata/overrides/itens.json` = `{ "base": <id do item original>, "name": "…" }` com **ID livre** (o menor acima de 900000 e de todo id do catálogo/overrides).
- O item é uma **cópia do original da base** (slot, tipo, atributos, requisitos, sprite) e se edita como qualquer item (nível, atributos-base, arma…). Os overrides da base **não** vazam para a cópia.
- Hot Reload (`itens`) cria/remove o item no catálogo em memória; **Apagar este item novo** remove a entrada. Não entra em drops/lojas sozinho: coloque-o onde quiser (loot de mob, conjuntos…).
- Regras (`systems/overrides.mjs › validarItem`): `base` precisa existir; o ID novo é de 900000 a 2.000.000.000 e não pode existir; só se duplica item **original** do catálogo.

## Sprite de item
- Aba **Sprite** do editor de Itens: PNG (um quadro de 8–128 px, até 32 quadros lado a lado = animação, até 600 KB). Grava `overrides/sprites/itens/<id>.png` + `overrides/itens-sprites.json` (`{ w, h, frames, hash }`); o atlas original não é tocado. **Voltar ao sprite original** remove só a imagem.
- Item novo usa o sprite do item-base até ganhar o seu. O cliente aplica os dois por cima do índice (`sprites.mjs › aplicarOverridesDeSpritesDeItens`). **Recarregue a página (F5)** para ver no jogo (o Hot Reload do servidor só valida).
- Validação central: check `sprites-itens` (imagem existe, hash bate, item existe).

## Criar mobs
Já existia a "variação" (`base` em `overrides/monstros.json`): agora há **+ Criar mob (duplicar)** na lista do editor de Mobs e **Criar mob novo a partir deste** na Biblioteca. O mob nasce como cópia (atributos, loot, ataques, sprite) com chave nova; para aparecer no jogo, coloque-o num mapa.

## Biblioteca com atalhos de edição
Fichas da Biblioteca geral: monstro → **Editar este monstro**; item → **Editar este item**; hunts → **Abrir no painel de Hunts**; bosses → **Abrir em Bosses únicos**; outfit/montaria/monstro → **Editar sprite**. (Mobs e Itens já tinham o atalho nas suas telas.)

Testes: `testes/itens-novos-sprites.test.mjs` (NV1–NV11).
