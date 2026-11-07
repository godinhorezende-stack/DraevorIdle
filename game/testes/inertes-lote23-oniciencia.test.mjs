// (07/11, lote 23 das inertes — o dono: "Fazer como no PoE") a ONISCIÊNCIA CRISTALIZADA: os atributos das peças viram Onisciência (a parte comum aos três conta uma
// vez), +1% de Resistências Elementais e 1% de penetração a cada 15, e os requisitos de atributo aceitam X% dela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const Requisitos = await import('../systems/personagem/requisitos.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const JOIA = [['Modificadores de Atributos, ao invés, se aplicam a Onisciência'], ['+{0}% de todas as Resistências Elementais por cada {1} de Onisciência', [1, 15]], ['Penetra {0}% das Resistências Elementais por cada {1} de Onisciência', [1, 15]], ['Requerimentos de Atributos podem ser satisfeitos por {0}% de Onisciência', [25]]];

function personagem(comJoia) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const anel = peca('Rings/Iron_Ring');
  const af = { str: 30 + 15, dex: 30, int: 30 };
  for (const [m, v] of comJoia ? JOIA : []) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  anel.poe.af = af;
  e.equipment = { ...e.equipment, ring: anel };
  Ficha.invalidar(e);
  return e;
}

test('as linhas da joia saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of JOIA) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('a ONISCIÊNCIA: +30 a todos e +15 de Força = 45; os atributos ficam os da classe; +3% de Resistências e 3% de penetração', { skip: SEM }, () => {
  const sem = personagem(false);
  const com = personagem(true);
  const pSem = Atributos.principais(sem, Afixos.soma(sem));
  const pCom = Atributos.principais(com, Afixos.soma(com));
  assert.equal(pCom.oniciencia, 45);
  assert.equal(pCom.str, pCom.daVocacao.str);
  assert.equal(pSem.str, pCom.daVocacao.str + 45);
  assert.equal((Afixos.soma(com).fire_res ?? 0) - (Afixos.soma(sem).fire_res ?? 0), 3);
  assert.equal((Afixos.soma(com).elem_pen ?? 0) - (Afixos.soma(sem).elem_pen ?? 0), 3);
});

test('os REQUISITOS: 25% da Onisciência satisfaz o requisito que os atributos da classe não alcançam', { skip: SEM }, () => {
  const e = personagem(true);
  const soma = Afixos.soma(e);
  const p = Atributos.principais(e, soma);
  const req = Math.floor((p.oniciencia * 25) / 100);
  const meta = { poe: { requisitos: { forca: req } } };
  const alta = { poe: { requisitos: { forca: req + 1000 } } };
  assert.equal(Requisitos.falta(meta, { ...p, str: 0 }, meta, soma), null);
  assert.ok(Requisitos.falta(alta, { ...p, str: 0 }, alta, soma));
});
