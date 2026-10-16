// O RELATÓRIO das passivas CONQUISTADAS das Joias Atemporais (lote 48): por conquistador, quantas linhas têm efeito no jogo, e a lista das
// traduzidas à mão (sem par na árvore do poedb — o dono confere) e das sem efeito. Grava `docs/atemporais-traducoes.md`.
//
//   ITENS_POE=1 node tools/relatorio-atemporais.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

process.env.ITENS_POE ??= '1';
const RAIZ = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(RAIZ, '..', '..', 'docs', 'atemporais-traducoes.md');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const d = JSON.parse(readFileSync(join(RAIZ, '..', 'gamedata', 'itens-poe', 'atemporais', 'atemporais.json'), 'utf8'));
const NOME = { vaal: 'Vaal (Vaidade Gloriosa)', karui: 'Karui (Orgulho Letal)', maraketh: 'Maraketh (Restrição Brutal)', templar: 'Templários (Fé Militante)', eternal: 'Império Eterno (Arrogância Elegante)', kalguur: 'Kalguuranos (Tragédia Heroica)' };
const tipoDe = (id) => id.split('_')[0].replace('kalguuran', 'kalguur');
// (a faixa "(a-b)" da Vaidade: o máximo, só para saber se a linha tem efeito)
const comEfeito = (l) => traduzirLinha(String(l).replace(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g, '$2')).efeitos.length > 0;
const conta = {};
const manuais = [];
const sem = [];
for (const [lista, oQue] of [[d.adicoes, 'adição'], [d.nos, 'nó']]) {
  for (const x of lista) {
    if (!x) continue;
    const t = tipoDe(x.id);
    x.pt.forEach((l, i) => {
      const ok = comEfeito(l);
      const c = (conta[t] ??= { com: 0, sem: 0 });
      c[ok ? 'com' : 'sem']++;
      const linha = { t, id: x.id, nome: x.nome, oQue: x.keystone ? 'keystone' : oQue, en: x.en[i], pt: l, ok };
      if (x.manuais?.includes(i)) manuais.push(linha);
      if (!ok) sem.push(linha);
    });
  }
}
const esc = (s) => String(s).replace(/\|/g, '\\|');
const md = [
  '# Joias Atemporais — as passivas conquistadas',
  '',
  `Gerado por \`game/tools/relatorio-atemporais.mjs\` (lote 48), a partir de \`game/gamedata/itens-poe/atemporais/atemporais.json\` (o importador \`tools/importar-pob-atemporais.mjs\`: o Path of Building, traduzido pela árvore do poedb; o que não casou, à mão). As do Abismo ficam de fora (outra mecânica).`,
  '',
  '## Por conquistador',
  '',
  '| Conquistador | Linhas | ✓ Com efeito | ✗ Sem efeito |',
  '|---|---:|---:|---:|',
  ...Object.entries(NOME).map(([t, n]) => `| ${n} | ${(conta[t]?.com ?? 0) + (conta[t]?.sem ?? 0)} | ${conta[t]?.com ?? 0} | ${conta[t]?.sem ?? 0} |`),
  '',
  `## As traduzidas à mão (${manuais.length}) — para o dono conferir`,
  '',
  '| Conquistador | Passiva | Inglês (PoB) | Português (jogo) | Efeito |',
  '|---|---|---|---|---|',
  ...manuais.map((l) => `| ${NOME[l.t]?.split(' ')[0] ?? l.t} | ${esc(l.nome)} (${l.oQue}) | ${esc(l.en)} | ${esc(l.pt)} | ${l.ok ? '✓' : '✗'} |`),
  '',
  `## Sem efeito no jogo (${sem.length})`,
  '',
  '| Conquistador | Passiva | Linha |',
  '|---|---|---|',
  ...sem.map((l) => `| ${NOME[l.t]?.split(' ')[0] ?? l.t} | ${esc(l.nome)} (${l.oQue}) | ${esc(l.pt)} |`),
  '',
];
writeFileSync(SAIDA, md.join('\n'));
console.log(`${manuais.length} à mão, ${sem.length} sem efeito → ${SAIDA}`);
console.log(JSON.stringify(conta));
