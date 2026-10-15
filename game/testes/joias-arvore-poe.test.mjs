// OS ENCAIXES DE JOIA da árvore do PoE (dono, 14/10: "Criar os encaixes de joia"): os 21 encaixes (15 Básicos e os 6 Grandes da borda; os
// Médios e Pequenos são das Joias Ramificadoras, fora) recebem as Joias Carmesim, Viridiana e Cobalto (a Prismática só Única), que entram no
// catálogo com ids fixos e caem; com o encaixe ALOCADO, os mods da joia valem como os de uma peça; o encaixe que sai da árvore devolve a joia
// à mochila (nunca some); e o Chieftain (Ngamahu, Avanço da Chama): com joia NÃO ÚNICA, os aumentos dos outros tipos de dano dos nós
// alocados no Raio Grande (1500) viram de Fogo e cada nó pequeno ou notável dá +4 de Força.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
const ENCAIXE = '6230'; // o Básico do centro (o da Scion)
const NGAMAHU = '50692';
const joia = (raridade = 'raro', af = { life: 30 }, base = 'Jewels/Crimson_Jewel') => {
  const p = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 70, rng: () => 0.5 }));
  p.poe.af = { ...af };
  return p;
};
function personagem({ alocados = [], ascendencia = null } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  if (ascendencia) e.passivas.ascendencia = ascendencia;
  e.passivas.alocados.push(...alocados);
  P.garantir(e);
  e.inventory = [];
  return e;
}
const encaixar = (e, peca, no = ENCAIXE) => {
  e.inventory.push(peca);
  return Comandos.comando(e, { action: 'encaixarJoia', no, pilha: e.inventory.length - 1, id: peca.id });
};

test('a ÁRVORE: as duas linhas do Ngamahu com efeito; os 21 encaixes que aceitam joia (os das Ramificadoras, não)', { skip: SEM }, () => {
  const ngamahu = P.arvore().porId.get(NGAMAHU);
  const linhas = ngamahu.textos.map((t, i) => ({ t, estado: ngamahu.estados[i], nota: ngamahu.notas?.[i] ?? '' })).filter((l) => /^Joias Não Únicas/.test(l.t));
  assert.equal(linhas.length, 2);
  for (const l of linhas) assert.ok(['novo', 'equivalente', 'aproximado'].includes(l.estado) && !/^não se aplica/.test(l.nota), `${l.estado}: ${l.t}`);
  assert.deepEqual(ngamahu.efeitos, [{ add: 'joia_transforma_fogo', valor: 1 }, { add: 'joia_forca_no_raio', valor: 4 }]);
  const cliente = P.arvoreParaCliente();
  const encaixes = cliente.nos.filter((n) => n.encaixeDeJoia);
  assert.equal(encaixes.length, 21);
  assert.deepEqual([...new Set(encaixes.map((n) => n.nomeEn))].sort(), ['Basic Jewel Socket', 'Large Jewel Socket']);
  assert.ok(!cliente.nos.some((n) => n.encaixeDeJoia && /Medium|Small/.test(n.nomeEn)));
  assert.equal(cliente.raiosDeJoia.grande, 1500);
});

test('o CATÁLOGO: as joias entram com ids fixos, sem slot, e caem; a Prismática só Única; o baú de nível 1 não dá joia', { skip: SEM }, () => {
  assert.deepEqual(Object.values(J.JOIAS), [7_800_001, 7_800_002, 7_800_003, 7_800_004]);
  for (const [base, id] of Object.entries(J.JOIAS)) {
    assert.equal(J.idDaBase(base), id, base);
    assert.equal(ITEM_CATALOG[id].joia, true);
    assert.equal(ITEM_CATALOG[id].slot, undefined, 'sem slot de equipamento');
  }
  const p = joia();
  assert.equal(p.id, 7_800_001);
  assert.equal(p.poe.classe, 'Jewels');
  assert.equal(p.soquetes ?? null, null, 'joia não tem socket');
  // (cai como as outras peças: a base fixa — o caminho da projeção offline — e o sorteio Raro)
  const rara = J.pecaSorteada(70, () => 0.98, Catalogo.REGRAS, 0, 'Jewels/Viridian_Jewel');
  assert.equal(rara?.id, 7_800_002);
  // (a Prismática: Normal, Mágica e Rara não existem no PoE)
  const cat = Catalogo.catalogo().classes.Jewels;
  const prismatica = cat.bases.find((b) => b.id === 'Jewels/Prismatic_Jewel');
  assert.equal(J.podeCairComo(cat, prismatica, 'raro'), false);
  assert.equal(J.podeCairComo(cat, prismatica, 'unico'), true);
  assert.equal(J.pecaSorteada(70, () => 0.98, Catalogo.REGRAS, 0, 'Jewels/Prismatic_Jewel'), null);
  let r = 0;
  for (let i = 0; i < 300; i++) assert.ok(!J.JOIAS[J.baseDoId(J.pecaDoBauInicial(() => ((r = (r * 9301 + 49297) % 233280) / 233280))?.id)]);
});

test('ENCAIXAR: só no encaixe alocado; os mods valem com o encaixe alocado; trocar e retirar devolvem à mochila', { skip: SEM }, () => {
  const e = personagem();
  const a = joia('raro', { life: 30 });
  assert.equal(encaixar(e, a).motivo, 'ENCAIXE_SEM_PONTO');
  assert.equal(e.inventory.length, 1, 'a joia continua na mochila');
  e.passivas.alocados.push(ENCAIXE);
  assert.equal(Comandos.comando(e, { action: 'encaixarJoia', no: ENCAIXE, pilha: 0, id: 1 }).motivo, 'NAO_E_JOIA');
  const vida = Afixos.soma(e).life ?? 0;
  const r = Comandos.comando(e, { action: 'encaixarJoia', no: ENCAIXE, pilha: 0, id: a.id });
  assert.deepEqual([r.ok, r.mudou], [true, true]);
  assert.equal(e.inventory.length, 0, 'saiu da mochila');
  assert.equal((Afixos.soma(e).life ?? 0) - vida, 30);
  assert.equal(P.vista(e).joias[ENCAIXE].poe.af.life, 30, 'a tela recebe a joia');
  // (trocar: a de antes volta inteira)
  const b = joia('magico', { str: 12 });
  assert.ok(encaixar(e, b).ok);
  assert.equal(e.inventory.length, 1);
  assert.deepEqual(e.inventory[0].poe.af, { life: 30 });
  assert.equal((Afixos.soma(e).life ?? 0) - vida, 0);
  // (retirar)
  assert.ok(Comandos.comando(e, { action: 'retirarJoia', no: ENCAIXE }).ok);
  assert.equal(e.inventory.length, 2);
  assert.equal(Comandos.comando(e, { action: 'retirarJoia', no: ENCAIXE }).motivo, 'ENCAIXE_VAZIO');
  // (nó que não é encaixe; o encaixe das Ramificadoras)
  const ramificadora = P.arvore().nos.find((n) => n.nomeEn === 'Medium Jewel Socket');
  assert.equal(Comandos.comando(e, { action: 'encaixarJoia', no: ramificadora.id, pilha: 0, id: e.inventory[0].id }).motivo, 'NAO_E_ENCAIXE');
});

test('o encaixe que sai da árvore (respec, troca de classe) DEVOLVE a joia à mochila — nunca some', { skip: SEM }, () => {
  const e = personagem({ alocados: [ENCAIXE] });
  assert.ok(encaixar(e, joia('raro', { life: 30 })).ok);
  const vida = Afixos.soma(e).life ?? 0;
  e.passivas.alocados.splice(e.passivas.alocados.indexOf(ENCAIXE), 1);
  P.garantir(e);
  assert.equal(e.passivas.joias[ENCAIXE], undefined);
  assert.equal(e.inventory.length, 1);
  assert.equal(e.inventory[0].poe.af.life, 30);
  assert.equal(vida - (Afixos.soma(e).life ?? 0), 30, 'a vida da joia saiu');
});

test('o CHIEFTAIN: com joia NÃO ÚNICA, o dano dos outros tipos dos nós no Raio Grande vira de Fogo e cada pequeno/notável dá +4 de Força', { skip: SEM }, () => {
  const s = P.arvore().porId.get(ENCAIXE);
  const longe = (n) => P.arvore().nos.filter((x) => P.ehEncaixeDeJoia(x)).every((t) => Math.hypot(n.x - t.x, n.y - t.y) > 1500);
  const fisico = (n) => !n.ascendencia && n.tipo === 'small' && n.efeitos?.length === 1 && n.efeitos[0].add === 'phys_dmg';
  const perto = P.arvore().nos.find((n) => fisico(n) && Math.hypot(n.x - s.x, n.y - s.y) <= 1500);
  const fora = P.arvore().nos.find((n) => fisico(n) && longe(n));
  assert.ok(perto && fora);
  const base = (e) => P.efeitos(e).adds;
  const e = personagem({ alocados: [ENCAIXE, perto.id, fora.id, NGAMAHU], ascendencia: 'Chieftain' });
  const sem = { ...base(e) };
  assert.ok(encaixar(e, joia('raro', {})).ok);
  const com = base(e);
  assert.equal((sem.phys_dmg ?? 0) - (com.phys_dmg ?? 0), perto.efeitos[0].valor, 'o de perto saiu do Físico');
  assert.equal((com.fire_dmg ?? 0) - (sem.fire_dmg ?? 0), perto.efeitos[0].valor, '… e entrou no Fogo');
  assert.equal((com.str ?? 0) - (sem.str ?? 0), 4, 'só o de perto (o de longe e o encaixe não contam)');
  // (joia ÚNICA: nada)
  assert.ok(Comandos.comando(e, { action: 'retirarJoia', no: ENCAIXE }).ok);
  assert.ok(encaixar(e, joia('unico', {})).ok);
  assert.equal(e.passivas.joias[ENCAIXE].poe.raridade, 'unico');
  assert.deepEqual([base(e).phys_dmg, base(e).str ?? 0], [sem.phys_dmg, sem.str ?? 0]);
  // (sem o Ngamahu: nada)
  const semNo = personagem({ alocados: [ENCAIXE, perto.id] });
  const antes = { ...base(semNo) };
  assert.ok(encaixar(semNo, joia('raro', {})).ok);
  assert.deepEqual([base(semNo).phys_dmg, base(semNo).fire_dmg, base(semNo).str], [antes.phys_dmg, antes.fire_dmg, antes.str]);
});
