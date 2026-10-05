# Conjuntos (sets de equipamento) — Engine › Conjuntos

Editor dos **sets de equipamento por classe**. Ferramenta de desenvolvimento e balanceamento: **não** dá bônus de conjunto, **não** muda drop, loot nem combate. Vale para Normal, Cruel e Merciless (um conjunto só, sem duplicar por dificuldade).

## Dados
- Fábrica: `gamedata/conjuntos.json` (nunca editada pela Engine) — `regras` (8 slots, slots obrigatórios), `planejamento` (5 classes × 6 conjuntos, levels 1–300, referência) e `conjuntos: {}` — **vazio**: nenhum conjunto é criado sozinho.
- Override: `gamedata/overrides/conjuntos.json` = `{ ativo, conjuntos: { id: {campos alterados} | { excluido: true } } }` (só o novo/diferente; histórico em `overrides/_versoes/conjuntos`).
- Conjunto: `id` (único, `[a-z0-9_-]{3,60}`), `nome`, `classe` (knight/paladin/druid/sorcerer/monk), `ato`, `tier`, `levelMin`, `levelMax`, `levelRecomendado?`, `descricao?`, `ativo`, `completo`, `pecas: { head, body, legs, feet, weapon, shield, ring, neck → id do item | null }`.
- Peças são só **referências** ao catálogo efetivo: editar o item no editor de itens reflete no conjunto; item inexistente/slot trocado/classe incompatível é sinalizado.
- Atos, tiers e o level máximo vêm de `systems/progressao.mjs` (configuráveis); nada fixo no código.

## Validação (`systems/conjuntos.mjs`)
Erros (impedem salvar): ID inválido/repetido, nome, classe inexistente, Ato inexistente, tier inválido, levelMin>levelMax, level acima do limite configurado, campo desconhecido, slot inexistente, item inexistente, item de outro slot, item restrito a outra classe, arma de duas mãos + escudo, "completo" com slot obrigatório vazio (a arma de duas mãos dispensa o escudo).
Avisos: conjunto incompleto (**pode** ser salvo), item com level mínimo acima da faixa do conjunto (o `minLevel` do item nunca é alterado), faixa fora do Ato, tier fora do Ato, recomendado fora da faixa, peça de craft, item repetido entre conjuntos ativos, lacunas de cobertura por classe.

## Tela
Filtros (busca, classe, Ato, tier, faixa de level, status), lista, criar/duplicar/excluir, 8 slots com sprite, seletor de itens (nome/ID, classe, tier, level), validação ao vivo, atributos totais pela **ficha real** (`Ficha.combate`) e **Painel de progressão** (contagens por classe/Ato, slots preenchidos/vazios, lacunas, repetidos, itens fora da faixa; clique na linha abre o conjunto). "Gerar modelos iniciais" cria 30 conjuntos vazios e inativos **só como rascunho na tela** até você salvar.

## Fluxo
Editar → prévia (`POST conjuntos/validar`) → **Salvar override** → Hot Reload local aplica → aprovar versão/Git/merge/deploy manuais (como os demais módulos). Restaurar um conjunto, voltar tudo ao original ou restaurar uma versão anterior estão na própria tela. Em produção a tela é somente leitura.

## Rotas (`/api/mapas/_conteudo/`)
GET `conjuntos`, `conjuntos/itens`, `conjuntos-versoes`, `conjuntos/totais/<id>`; POST (leitura) `conjuntos/validar|totais|modelos`; POST `conjuntos` (grava): `acao` = salvar | reverter | reverter-conjunto | ativo | restaurar (com `revisao`; conflito = 409).

Testes: `testes/conjuntos.test.mjs`.
