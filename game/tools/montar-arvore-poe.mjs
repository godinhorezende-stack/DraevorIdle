// Monta `gamedata/itens-poe/arvore-poe.json`: a árvore de passivas do PoE (2.429 nós da coleção do Drive) no formato da árvore do
// Draevor, com os efeitos de cada nó traduzidos (`systems/itens-poe/arvore.mjs`). Valida com o mesmo validador da árvore do jogo.
// Sistema de itens do PoE, Fase 1 (incremento 4b) — em produção a árvore do Draevor continua; esta só entra com ITENS_POE=1 (4c).
//
// Uso: node tools/montar-arvore-poe.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { converterArvore, converterAscendencias } from '../systems/itens-poe/arvore.mjs';
import { validar } from '../systems/passivas/arvore.mjs';

const ORIGEM = '/home/deploy/referencias-poe/original/poe-arvore/Arvore_Principal/arvore.json';
const ASCENDENCIAS = '/home/deploy/referencias-poe/original/poe-arvore/Ascendencias';
// A árvore completa (o arquivo oficial do jogo): o grupo de cada nó e as maestrias com as opções.
const COMPLETA = '/home/deploy/referencias-poe/original/poe-arvore/Arvore_Completa/arvore-completa.json';
const DESTINO = new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url);
// (09/10) Os TEXTOS ATUAIS de cada nó (a árvore do poedb, PoE 1 3.29 — extraída com o Scrapling, /home/deploy/scrapling): pelo id do nó (o
// mesmo do PoE), no lugar dos da coleção do Drive, que são de uma versão anterior e trazem linhas partidas e ids crus ("generic_buff_aura").
// As maestrias pelo id do efeito. Sem o arquivo, ficam os da coleção. A posição e as ligações continuam as da coleção.
const POEDB = process.env.POEDB_ARVORE ?? '/home/deploy/scrapling/saida/arvore/arvore-poedb-3.29-pt.json';
const textos = new Map();
// (09/10, auditoria da árvore) As OPÇÕES DE ESCOLHA das ascendências (poedb: `isMultipleChoiceOption` — "Estilo de Assassinato", os
// "Mostruários" da Caçadora de Relíquias, as "Ascensões" da Ascendente): `id da opção → id do nó-pai` (o nó ligado a ela).
const escolhas = new Map();
if (existsSync(POEDB)) {
  for (const [id, n] of Object.entries(JSON.parse(readFileSync(POEDB, 'utf8')).nodes ?? {})) {
    if (id === 'root') continue;
    if (n.isMultipleChoiceOption) { const pai = [...(n.in ?? []), ...(n.out ?? [])][0]; if (pai != null) escolhas.set(String(id), String(pai)); }
    // (+ o texto de lembrete do PoE, entre parênteses: o balão mostra como nota.)
    if (n.stats?.length) textos.set(String(id), [...n.stats, ...(n.reminderText ?? [])]);
    for (const m of n.masteryEffects ?? []) if (m.stats?.length) textos.set(`maestria:${m.effect}`, m.stats);
  }
  console.log(`textos do poedb: ${textos.size} (${POEDB})`);
}

const { arvore, relatorio } = converterArvore(JSON.parse(readFileSync(ORIGEM, 'utf8')), JSON.parse(readFileSync(COMPLETA, 'utf8')), textos);
// As 21 ascendências (incremento 4e): pedaços à parte, cada um com o próprio início.
const listaAsc = readdirSync(ASCENDENCIAS).filter((d) => existsSync(`${ASCENDENCIAS}/${d}/ascendencia.json`)).sort().map((d) => JSON.parse(readFileSync(`${ASCENDENCIAS}/${d}/ascendencia.json`, 'utf8')));
const asc = converterAscendencias(listaAsc, textos, escolhas);
const repetidos = asc.nos.filter((n) => arvore.nos.some((m) => m.id === n.id));
if (repetidos.length) throw new Error(`ids de ascendência repetidos na árvore: ${repetidos.map((n) => n.id).join(', ')}`);
arvore.nos.push(...asc.nos);
Object.assign(arvore.inicios, asc.inicios);
arvore.ascendencias = asc.ascendencias;
relatorio.ascendencias = asc.relatorio;
const erros = validar(arvore);
if (erros.length) {
  console.error(`árvore inválida (${erros.length} problemas):\n${erros.slice(0, 20).join('\n')}`);
  process.exit(1);
}
const saida = {
  _nota: 'A árvore de passivas do PoE no formato da árvore do Draevor (gerada por tools/montar-arvore-poe.mjs a partir da coleção do Drive). Cada nó: custo 1 (como no PoE; a opção de escolha de uma ascendência, `opcaoDe`, custo 0), os efeitos traduzidos (add = atributo somado, com condição/escala na chave; stat = % de vida/mana/precisão no formato da árvore do Draevor), os TEXTOS originais e o estado de cada linha (equivalente/aproximado/novo/registrado/nota). As 21 ASCENDÊNCIAS vêm junto, como pedaços à parte na borda (nós com `ascendencia`, início em inicios["asc:<slug>"], dados em `ascendencias`). Só entra no jogo com ITENS_POE=1.',
  relatorio,
  ...arvore,
};
writeFileSync(DESTINO, JSON.stringify(saida) + '\n');
console.log(JSON.stringify(relatorio), '→', DESTINO.pathname);
