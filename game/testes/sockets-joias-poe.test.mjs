// Anel, amuleto e cinto do PoE não têm socket (dono, 08/10: "amuletos, cintos e anéis — esses não têm sockets, e aqui está aparecendo no
// sistema de gemas"). O servidor já decidia pela classe (`itens-poe/sockets.mjs`: elas não estão em `porClasse`); a TELA das gemas
// (client/src/soquetes.mjs) desenhava a peça sem `soquetes` com os sockets "bloqueados" da tabela do Draevor por slot (cinto 2, amuleto 1,
// anel 1). A exceção do PoE fica: a base com "Possui N Encaixes" (o Anel Desmontado, por exemplo) tem esses N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SOQUETES = readFileSync(new URL('../frontend/client/src/soquetes.mjs', import.meta.url), 'utf8');
const LIMITE = SOQUETES.match(/const limiteDaPeca = [^\n]+/)?.[0];
// A tabela do Draevor por slot (o catálogo dos orbes), como a tela recebe.
const TABELA_DO_DRAEVOR = { weapon: 2, body: 6, head: 4, legs: 2, neck: 1, ring: 1, ring2: 1 };
const limiteDaPeca = new Function('limiteDoSlot', `${LIMITE}\nreturn limiteDaPeca;`)((slot) => TABELA_DO_DRAEVOR[slot] ?? 0);

test('a tela das gemas: a peça do PoE sem sockets não tem socket nenhum (nem "bloqueado"); com sockets, os dela', () => {
  assert.ok(LIMITE, 'achei o limiteDaPeca');
  for (const [slot, classe] of [['legs', 'Belts'], ['neck', 'Amulets'], ['ring', 'Rings'], ['ring2', 'Rings']]) {
    assert.equal(limiteDaPeca({ id: 7000001, poe: { classe } }, slot), 0, `${classe} sem sockets`);
  }
  assert.equal(limiteDaPeca({ id: 7000001, poe: { classe: 'Rings' }, soquetes: { abertos: 1, links: [], gemas: [null] } }, 'ring'), 1, 'o Anel Desmontado ("Possui 1 Encaixes")');
  assert.equal(limiteDaPeca({ id: 7000001, poe: { classe: 'Body_Armours' }, soquetes: { abertos: 2, links: [false, false, false], gemas: [null, null, null, null] } }, 'body'), 4);
  // A peça do Draevor (o modo clássico) segue a tabela do slot.
  assert.equal(limiteDaPeca({ id: 3008 }, 'neck'), 1);
  assert.equal(limiteDaPeca({ id: 3008 }, 'legs'), 2);
  // E a tela usa essa regra nos três lugares (a lista, a janela dos orbes e a fila de sockets).
  assert.equal((SOQUETES.match(/limiteDaPeca\(peca, slot\)/g) ?? []).length, 3);
});

test('o servidor: anel, amuleto e cinto do PoE que caem não têm sockets — só a base com "Possui N Encaixes"', { skip: !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE ausente' }, async () => {
  await import('./apoio.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const GS = await import('../systems/skills/gemas.mjs');
  let joias = 0;
  for (let i = 0; i < 4000; i++) {
    const p = J.pecaSorteada(40, Math.random, undefined, 100);
    if (!['Rings', 'Amulets', 'Belts'].includes(p?.poe?.classe)) continue;
    joias++;
    const fixos = Math.round(Number(p.poe.af?.encaixes_fixos) || 0);
    assert.equal(GS.soquetesDe(p)?.max ?? 0, fixos, `${p.poe.classe} ${p.poe.base}: ${fixos ? `a base tem ${fixos}` : 'sem sockets'}`);
  }
  assert.ok(joias > 100, `sorteou ${joias} joias`);
});
