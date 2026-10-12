// A FORJA pega a moeda do BAÚ também (dono, 12/10: "forja pode pegar materiais do baú também"): a moeda conta na mochila e nas caixas do
// depósito do personagem (as numeradas e as Chegadas — onde o "Mover Orbs" da bolsa de loot põe os orbes) e sai primeiro da mochila,
// depois do baú. Vale na forja de uma tentativa, na repetição, nos orbes de socket, nas lascas e no ensaio (o motivo de não valer). O baú da
// CONTA (compartilhado, gravado à parte no banco) fica de fora. O Gem Atelier continua gastando da mochila.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const M = await import('../systems/itens-poe/moedas.mjs');
const F = await import('../systems/itens-poe/forja.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const Deposito = await import('../systems/deposito.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

function rngDe(semente) {
  let s = semente >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const gerar = (base, raridade, ilvl, semente = 1) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: rngDe(semente) }));
const NA_MOCHILA = { onde: 'inventory', indice: 0 };
/** Um personagem com a peça na mochila e as moedas `{ slug: n }` na mochila e no baú (a caixa 0 e as Chegadas). */
function personagem(peca, { mochila = {}, caixa = {}, chegadas = {}, conta = {} } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const lista = (o) => Object.entries(o).map(([slug, n]) => ({ id: M.idDa(slug), count: n }));
  e.inventory = [peca, ...lista(mochila)];
  Deposito.garantir(e);
  e.deposito.find((c) => c.indice === 0).itens = lista(caixa);
  e.deposito.find((c) => c.chegadas).itens = lista(chegadas);
  e.bauDaConta = Deposito.caixaDaConta(null);
  e.bauDaConta.itens = lista(conta);
  return e;
}
const naMochila = (e, slug) => e.inventory.filter((x) => x.id === M.idDa(slug)).reduce((t, x) => t + (x.count ?? 1), 0);
const naCaixa = (e, indice, slug) => (e.deposito.find((c) => c.indice === indice)?.itens ?? []).filter((x) => x.id === M.idDa(slug)).reduce((t, x) => t + (x.count ?? 1), 0);

test('a moeda só no baú: a Forja a mostra, valida e gasta dela (uma tentativa e a repetição); a caixa atualiza', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80, 3);
  const e = personagem(p, { caixa: { Chaos_Orb: 3 }, chegadas: { Chaos_Orb: 2 } });
  assert.deepEqual(M.ondeTem(e, M.idDa('Chaos_Orb')), { mochila: 0, bau: 5, total: 5 });
  const o = F.opcoes(e, { alvo: NA_MOCHILA, categoria: 'atributos', moeda: M.idDa('Chaos_Orb') });
  const caos = o.materiais.find((x) => x.slug === 'Chaos_Orb');
  assert.equal(caos.tem, 5);
  assert.equal(caos.noBau, 5);
  assert.equal(caos.motivo, null, 'o ensaio acha a moeda no baú');
  const r = F.repetir(e, null, { id: 'b1', passo: 0, moeda: M.idDa('Chaos_Orb'), alvo: NA_MOCHILA, categoria: 'atributos', modo: 'uma' }, rngDe(1));
  assert.equal(r.resposta.motivo, 'feito', r.resposta.mensagem);
  assert.equal(M.quantasTem(e, M.idDa('Chaos_Orb')), 4);
  // Repetir com um desejo que quase nunca sai em 4 (três modificadores no melhor tier ao mesmo tempo): gasta o resto do baú e para.
  const fams = F.opcoes(e, { alvo: NA_MOCHILA, categoria: 'atributos' }).familias;
  const escolha = [...fams.filter((x) => x.lado === 'prefixo').slice(0, 2), ...fams.filter((x) => x.lado === 'sufixo').slice(0, 1)];
  const desejo = { mods: escolha.map((x) => ({ familia: x.familia, tierMax: x.tiers[0].tier })), modo: 'todos' };
  let g = null;
  let res;
  for (let passo = 0; passo < 10; passo++) {
    res = F.repetir(e, g, { id: 'b2', passo, moeda: M.idDa('Chaos_Orb'), alvo: NA_MOCHILA, categoria: 'atributos', modo: 'limite', limite: 50, desejo }, rngDe(2));
    g = res.guardado;
    if (res.resposta.fim) break;
  }
  assert.notEqual(res.resposta.motivo, 'erro', res.resposta.mensagem);
  if (res.resposta.motivo !== 'atingiu') {
    assert.equal(res.resposta.motivo, 'semMaterial');
    assert.equal(M.quantasTem(e, M.idDa('Chaos_Orb')), 0);
    assert.equal(e.deposito.find((c) => c.indice === 0).tipos, 0, 'a caixa vazia fica sem o tipo');
  }
});

test('a ordem: primeiro a mochila, depois o baú; o baú da conta não entra', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80, 4);
  const e = personagem(p, { mochila: { Chaos_Orb: 1 }, caixa: { Chaos_Orb: 2 }, conta: { Chaos_Orb: 50 } });
  assert.equal(M.quantasTem(e, M.idDa('Chaos_Orb')), 3, 'o baú da conta não conta');
  assert.equal(M.usar(e, { moeda: M.idDa('Chaos_Orb'), alvo: NA_MOCHILA }, rngDe(3)).ok, true);
  assert.equal(naMochila(e, 'Chaos_Orb'), 0, 'saiu da mochila primeiro');
  assert.equal(naCaixa(e, 0, 'Chaos_Orb'), 2);
  assert.equal(M.usar(e, { moeda: M.idDa('Chaos_Orb'), alvo: NA_MOCHILA }, rngDe(4)).ok, true);
  assert.equal(naCaixa(e, 0, 'Chaos_Orb'), 1, 'depois do baú');
  assert.equal(e.bauDaConta.itens[0].count, 50, 'o baú da conta ficou intacto');
});

test('o orbe de socket do baú: a Forja usa e gasta do baú; o Gem Atelier continua gastando da mochila', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80, 5);
  p.soquetes = { abertos: 2, links: Array(5).fill(false), gemas: Array(6).fill(null), cores: Array(6).fill('R') };
  const e = personagem(p, { caixa: { Jewellers_Orb: 4 } });
  const r = M.usar(e, { moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA }, rngDe(6));
  assert.equal(r.ok, true, r.erro);
  assert.equal(naCaixa(e, 0, 'Jewellers_Orb'), 3, 'um Joalheiro saiu do baú');
  // O Gem Atelier (`{t:'gema', action:'orbePoe'}`) é da peça vestida e da mochila, como antes.
  e.equipment.body = p;
  e.inventory.splice(0, 1);
  assert.match(Gemas.usarOrbeDoPoe(e, { slot: 'body', tipo: 'joalheiro' }).erro ?? '', /Você não tem/);
  assert.equal(naCaixa(e, 0, 'Jewellers_Orb'), 3);
});

test('as lascas juntam as da mochila e as do baú (20 formam 1 orbe)', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80, 6);
  const e = personagem(p, { mochila: { Chaos_Shard: 8 }, caixa: { Chaos_Shard: 15 } });
  const r = M.usar(e, { moeda: M.idDa('Chaos_Shard') }, rngDe(7));
  assert.equal(r.ok, true, r.erro);
  assert.equal(M.quantasTem(e, M.idDa('Chaos_Shard')), 3, '23 − 20');
  assert.equal(naMochila(e, 'Chaos_Shard'), 0, 'as da mochila saem primeiro');
  assert.equal(naMochila(e, 'Chaos_Orb'), 1, 'o orbe formado vai para a mochila');
});
