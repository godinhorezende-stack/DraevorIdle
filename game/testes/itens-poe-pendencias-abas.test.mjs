// A aba ABAS DO POEDB da engine (admin/itens-poe-abas.mjs) e os pools das abas (`gamedata/itens-poe/pools-poedb/`, tools/importar-poedb-abas.mjs):
// as 66 páginas de classe do poedb que o dono listou (09/10), cada aba com o estado contra o jogo; o pool de cada uma com o "alcance" (qual
// sistema do jogo o põe numa peça) e o efeito; os complementos só com o que a coleção antiga não tinha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import './apoio.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as P from '../admin/itens-poe-pendencias.mjs';
import * as Abas from '../admin/itens-poe-abas.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !existsSync(Abas.ARQUIVO)) && 'dados do PoE ausentes nesta máquina';

test('o manifesto tem as 66 páginas de classe, cada aba com um estado; os pools com alcance e efeito', { skip: SEM }, () => {
  const d = Abas.abas();
  assert.equal(d.paginas.length, 66);
  for (const p of d.paginas) {
    assert.ok(p.classe, `${p.pagina}: a classe do catálogo`);
    for (const a of p.abas) assert.ok(['ok', 'importado', 'falta', 'referencia'].includes(a.estado), `${p.pagina}/${a.id}: ${a.estado}`);
  }
  const luvas = d.paginas.find((p) => p.pagina === 'Gloves_str');
  const vaal = luvas.abas.find((a) => a.pool === 'corrupted');
  assert.equal(vaal.estado, 'ok');
  assert.match(vaal.alcance, /Orbe Vaal/);
  assert.ok(vaal.efeito?.funciona > 0, 'o efeito dos corrompidos das luvas');
  const lab = luvas.abas.find((a) => a.pool === 'labirinto');
  assert.equal(lab.estado, 'importado');
  assert.equal(lab.alcance, null, 'o Labirinto ainda não tem caminho no jogo');
  assert.equal(d.paginas.find((p) => p.pagina === 'Two_Hand_Swords').abas.find((a) => a.pool === 'corrupted').estado, 'importado');
});

test('os pools de referência da aba Pendências existem em pools-poedb/ e entram à parte (não misturam com o que cai)', { skip: SEM }, () => {
  const doPoedb = new Set(Catalogo.poolsDoPoedb());
  for (const k of Object.keys(P.POOLS_DE_REFERENCIA)) assert.ok(doPoedb.has(k), k);
  P.esquecer();
  const d = P.pendencias();
  assert.ok(d.resumo.labirinto, 'o Labirinto na aba');
  assert.deepEqual(d.referencia, P.POOLS_DE_REFERENCIA);
  for (const k of Object.keys(P.POOLS_DE_REFERENCIA)) assert.ok(!(k in P.POOLS_DO_JOGO), `${k} não é pool do jogo`);
});

test('os complementos só trazem famílias que a coleção não tem (nenhuma repetida nem trocada)', { skip: SEM }, () => {
  for (const nome of Catalogo.poolsDoPoedb()) {
    const extra = JSON.parse(readFileSync(new URL(`../gamedata/itens-poe/pools-poedb/${nome}.json`, import.meta.url), 'utf8'));
    if (!extra.complemento) continue;
    const base = JSON.parse(readFileSync(new URL(`../gamedata/itens-poe/pools/${nome}.json`, import.meta.url), 'utf8'));
    for (const [classe, paginas] of Object.entries(extra.classes)) {
      for (const [pagina, pg] of Object.entries(paginas)) {
        const ja = new Set(['prefixos', 'sufixos', 'implicitos'].flatMap((l) => base.classes?.[classe]?.[pagina]?.[l] ?? []).map((f) => f.familia));
        for (const l of ['prefixos', 'sufixos', 'implicitos']) for (const f of pg[l] ?? []) assert.ok(!ja.has(f.familia), `${nome}/${classe}/${pagina}: ${f.familia} repetida`);
      }
    }
  }
});
