// Monta `gamedata/itens-poe/arvore-poe.json`: a árvore de passivas do PoE (2.429 nós da coleção do Drive) no formato da árvore do
// Draevor, com os efeitos de cada nó traduzidos (`systems/itens-poe/arvore.mjs`). Valida com o mesmo validador da árvore do jogo.
// Sistema de itens do PoE, Fase 1 (incremento 4b) — em produção a árvore do Draevor continua; esta só entra com ITENS_POE=1 (4c).
//
// Uso: node tools/montar-arvore-poe.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { converterArvore } from '../systems/itens-poe/arvore.mjs';
import { validar } from '../systems/passivas/arvore.mjs';

const ORIGEM = '/home/deploy/referencias-poe/original/poe-arvore/Arvore_Principal/arvore.json';
const DESTINO = new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url);

const { arvore, relatorio } = converterArvore(JSON.parse(readFileSync(ORIGEM, 'utf8')));
const erros = validar(arvore);
if (erros.length) {
  console.error(`árvore inválida (${erros.length} problemas):\n${erros.slice(0, 20).join('\n')}`);
  process.exit(1);
}
const saida = {
  _nota: 'A árvore de passivas do PoE no formato da árvore do Draevor (gerada por tools/montar-arvore-poe.mjs a partir da coleção do Drive). Cada nó: custo 1 (como no PoE), os efeitos traduzidos (add = atributo somado, tag = dano % por tag), os TEXTOS originais e o estado de cada linha (equivalente/aproximado/novo/registrado/nota). Só entra no jogo com ITENS_POE=1.',
  relatorio,
  ...arvore,
};
writeFileSync(DESTINO, JSON.stringify(saida) + '\n');
console.log(JSON.stringify(relatorio), '→', DESTINO.pathname);
