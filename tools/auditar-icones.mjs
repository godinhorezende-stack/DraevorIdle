// Auditoria dos ÍCONES dos itens (01/10). Só LÊ: catálogo, índice de sprites, atlas e bestiário.
//
// Como o cliente acha a figura de um item (`client/src/sprites.mjs`), na ordem:
//   1. `gamedata/item-sprites.json[id]` (o índice do atlas: página, x, y, quadros);
//   2. `DESENHO_EMPRESTADO` (no próprio sprites.mjs: itens da loja que o atlas não tem);
//   3. o `spriteDe` do catálogo (empréstimo vindo do servidor) e as gemas de skill (`gemaDef`,
//      desenhadas na hora).
// Sem nenhum dos três, o ícone era um quadrado vazio.
//
// Uso (da raiz):  node tools/auditar-icones.mjs            -> docs/auditoria-icones.md e .html
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../game/systems/dados.mjs';
import { BESTIARY } from '../game/systems/hunt/monstros.mjs';
import { VALOR_DA_MOEDA } from '../game/systems/inventario.mjs';

const RAIZ = new URL('../', import.meta.url);
const ATLAS = new URL('game/gamedata/sprites/items/', RAIZ);
const SPRITES = JSON.parse(readFileSync(new URL('game/gamedata/item-sprites.json', RAIZ), 'utf8'));

/** O `DESENHO_EMPRESTADO` do cliente, lido do código (o módulo é de navegador). */
export function emprestadosDoCliente() {
  const fonte = readFileSync(new URL('game/frontend/client/src/sprites.mjs', RAIZ), 'utf8');
  const bloco = fonte.match(/const DESENHO_EMPRESTADO = \{([\s\S]*?)\};/)?.[1] ?? '';
  return Object.fromEntries([...bloco.matchAll(/(\d+)\s*:\s*(\d+)/g)].map(([, a, b]) => [Number(a), Number(b)]));
}

/** Largura e altura de um PNG pelo cabeçalho (null se não é PNG válido). */
function tamanhoDoPng(caminho) {
  const b = readFileSync(caminho);
  const assinatura = '89504e470d0a1a0a';
  if (b.length < 24 || b.subarray(0, 8).toString('hex') !== assinatura || b.subarray(12, 16).toString() !== 'IHDR') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export function auditar() {
  const emprestados = emprestadosDoCliente();
  const paginas = new Map(); // arquivo -> {w,h} | null
  for (const f of readdirSync(ATLAS)) if (f.endsWith('.png')) paginas.set(f, tamanhoDoPng(new URL(f, ATLAS)));
  const usadas = new Set();

  /** O sprite que o cliente resolve para o id (e de onde ele veio). */
  const resolver = (id) => {
    const meta = ITEM_CATALOG[id];
    if (meta?.gemaDef) return { origem: 'gema desenhada', sprite: null };
    if (SPRITES[id]) return { origem: 'atlas', sprite: SPRITES[id] };
    if (emprestados[id] && SPRITES[emprestados[id]]) return { origem: `emprestado do ${emprestados[id]} (cliente)`, sprite: SPRITES[emprestados[id]], de: emprestados[id] };
    if (meta?.spriteDe && SPRITES[meta.spriteDe]) return { origem: `emprestado do ${meta.spriteDe} (catálogo)`, sprite: SPRITES[meta.spriteDe], de: meta.spriteDe };
    return { origem: 'sem imagem', sprite: null };
  };

  /** Os problemas de um sprite: página que não existe, quadro fora da imagem. */
  const problemas = (sprite) => {
    if (!sprite || sprite.gerada) return [];
    const erros = [];
    const quadros = sprite.s?.length ? sprite.s : [[0, sprite.x, sprite.y]];
    for (const [pagina, x, y] of quadros) {
      const arquivo = `${sprite.b ?? 'items32-'}${pagina}.png`;
      usadas.add(arquivo);
      if (!paginas.has(arquivo)) {
        const parecido = [...paginas.keys()].find((p) => p.toLowerCase() === arquivo.toLowerCase());
        erros.push(parecido ? `maiúsc./minúsc.: ${arquivo} ≠ ${parecido}` : `página inexistente: ${arquivo}`);
        continue;
      }
      const t = paginas.get(arquivo);
      if (!t) erros.push(`PNG inválido: ${arquivo}`);
      else if (x < 0 || y < 0 || x + sprite.w > t.w || y + sprite.h > t.h) erros.push(`quadro fora da página: ${arquivo} (${x},${y})`);
    }
    return erros;
  };

  const itens = Object.entries(ITEM_CATALOG).map(([id, meta]) => {
    const r = resolver(Number(id));
    return { id: Number(id), nome: meta.name ?? '', tipo: meta.type ?? meta.slot ?? '—', raridade: meta.rarity ?? '—', ...r, erros: problemas(r.sprite) };
  });

  // O que cai dos bichos (é o que a Bolsa de Loot mostra) — inclusive id que o catálogo não tem.
  const doLoot = new Map();
  for (const [chave, b] of Object.entries(BESTIARY)) for (const l of b.loot ?? []) {
    if (l.id == null || VALOR_DA_MOEDA[l.id] != null) continue;
    const e = doLoot.get(l.id) ?? { id: l.id, nome: ITEM_CATALOG[l.id]?.name ?? l.name ?? '', bichos: 0 };
    e.bichos++;
    doLoot.set(l.id, e);
  }
  const lootSemImagem = [...doLoot.values()].filter((e) => resolver(e.id).origem === 'sem imagem' || problemas(resolver(e.id).sprite).length).sort((a, b) => b.bichos - a.bichos);
  const spritesSemItem = Object.keys(SPRITES).filter((id) => !ITEM_CATALOG[id]).map(Number);
  const paginasSemUso = [...paginas.keys()].filter((p) => !usadas.has(p));
  for (const id of Object.keys(SPRITES)) problemas(SPRITES[id]); // marca as páginas usadas por todo o índice
  return {
    itens, lootSemImagem, spritesSemItem,
    paginas: [...paginas].map(([f, t]) => ({ arquivo: f, valido: !!t, ...t })),
    paginasSemUso: paginasSemUso.filter((p) => !usadas.has(p)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = auditar();
  const sem = a.itens.filter((i) => i.origem === 'sem imagem');
  const comErro = a.itens.filter((i) => i.erros.length);
  const emprestados = a.itens.filter((i) => i.origem.startsWith('emprestado'));
  const n = (v) => v.toLocaleString('pt-BR');
  const md = [];
  const o = (s = '') => md.push(s);
  o('# Auditoria — ícones dos itens');
  o('');
  o('Gerado por `tools/auditar-icones.mjs` (só leitura). Visual: `docs/auditoria-icones.html` (abrir a partir da raiz do repositório).');
  o('');
  o('| | Itens |');
  o('|---|---|');
  o(`| Itens no catálogo | ${n(a.itens.length)} |`);
  o(`| Com imagem válida do atlas | ${n(a.itens.filter((i) => i.origem === 'atlas' && !i.erros.length).length)} |`);
  o(`| Gema desenhada na hora | ${n(a.itens.filter((i) => i.origem === 'gema desenhada').length)} |`);
  o(`| Emprestada de outro item (conferir) | ${n(emprestados.length)} |`);
  o(`| **Sem imagem** | **${n(sem.length)}** |`);
  o(`| Caminho/quadro inválido | ${n(comErro.length)} |`);
  o(`| Ids do LOOT dos bichos sem imagem (a Bolsa de Loot) | ${n(a.lootSemImagem.length)} |`);
  o(`| Sprites no índice sem item no catálogo | ${n(a.spritesSemItem.length)} |`);
  o(`| Páginas do atlas | ${a.paginas.map((p) => `${p.arquivo} ${p.valido ? `${p.w}×${p.h}` : 'INVÁLIDA'}`).join(' · ')} |`);
  o(`| Páginas sem uso | ${a.paginasSemUso.join(', ') || 'nenhuma'} |`);
  o('');
  o(`## Itens que caem dos bichos e não têm imagem — ${a.lootSemImagem.length} (precisam de ícone novo)`);
  o('');
  o('| id | Nome | No catálogo? | Bichos que dropam |');
  o('|---|---|---|---|');
  for (const e of a.lootSemImagem) o(`| ${e.id} | ${e.nome || '—'} | ${ITEM_CATALOG[e.id] ? 'sim' : '**não**'} | ${e.bichos} |`);
  o('');
  o(`## Caminhos ou quadros inválidos — ${comErro.length}`);
  o('');
  for (const i of comErro) o(`- ${i.id} ${i.nome}: ${i.erros.join('; ')}`);
  if (!comErro.length) o('Nenhum: toda entrada do índice aponta para uma página que existe, com o quadro dentro da imagem, e as páginas são PNG válidos.');
  o('');
  o(`## Ícones emprestados de outro item — ${emprestados.length} (conferir se fazem sentido)`);
  o('');
  o('| id | Item | Usa a figura de |');
  o('|---|---|---|');
  for (const i of emprestados) o(`| ${i.id} | ${i.nome} | ${i.de} (${ITEM_CATALOG[i.de]?.name ?? '?'}) |`);
  o('');
  const porTipo = {};
  for (const i of sem) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
  o(`## Itens do catálogo sem imagem — ${sem.length}, por tipo`);
  o('');
  o('| Tipo | Itens |');
  o('|---|---|');
  for (const [t, c] of Object.entries(porTipo).sort((x, y) => y[1] - x[1])) o(`| ${t} | ${c} |`);
  o('');
  o('Lista completa (id — nome — tipo):');
  o('');
  for (const i of sem) o(`- ${i.id} — ${i.nome || '(sem nome)'} — ${i.tipo}`);
  writeFileSync(new URL('docs/auditoria-icones.md', RAIZ), md.join('\n') + '\n');

  // O relatório VISUAL: o fallback dos que não têm imagem e as figuras emprestadas, recortadas do atlas.
  const recorte = (s) => {
    const [pagina, x, y] = s.s?.[0] ?? [0, s.x, s.y];
    return `<span class="ico" style="width:${s.w}px;height:${s.h}px;background:url('../game/gamedata/sprites/items/${s.b ?? 'items32-'}${pagina}.png') -${x}px -${y}px"></span>`;
  };
  const cartao = (i, figura, extra = '') => `<div class="c">${figura}<b>${i.id}</b><i>${(i.nome || '(sem nome)').replace(/</g, '&lt;')}</i>${extra}</div>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Auditoria de ícones</title>
<style>body{font:13px system-ui;background:#15181c;color:#ddd;margin:16px}h2{margin-top:28px}.g{display:flex;flex-wrap:wrap;gap:8px}.c{width:120px;background:#20252b;border:1px solid #333;border-radius:6px;padding:6px;display:grid;justify-items:center;gap:2px}.c i{font-size:11px;text-align:center;color:#aaa}.ico{display:inline-block;image-rendering:pixelated;transform:scale(1.5);margin:6px}.sem{width:32px;height:32px;border:1px dashed #888;border-radius:4px;display:grid;place-items:center;color:#888;font:700 18px system-ui}</style>
<h1>Auditoria de ícones dos itens</h1><p>Abrir a partir da pasta docs/ do repositório (as figuras vêm do atlas em game/gamedata/sprites/items).</p>
<h2>Caem dos bichos e não têm imagem (${a.lootSemImagem.length})</h2><div class="g">${a.lootSemImagem.map((e) => cartao(e, '<span class="sem">?</span>', `<i>${e.bichos} bicho(s)${ITEM_CATALOG[e.id] ? '' : ' · fora do catálogo'}</i>`)).join('')}</div>
<h2>Emprestados de outro item (${emprestados.length}) — conferir</h2><div class="g">${emprestados.map((i) => cartao(i, recorte(i.sprite), `<i>figura do ${i.de}</i>`)).join('')}</div>
<h2>Sem imagem no catálogo (${sem.length})</h2><div class="g">${sem.slice(0, 400).map((i) => cartao(i, '<span class="sem">?</span>', `<i>${i.tipo}</i>`)).join('')}</div>${sem.length > 400 ? `<p>… e mais ${sem.length - 400} (lista completa no .md)</p>` : ''}`;
  writeFileSync(new URL('docs/auditoria-icones.html', RAIZ), html);
  console.log(md.slice(0, 18).join('\n'));
}
