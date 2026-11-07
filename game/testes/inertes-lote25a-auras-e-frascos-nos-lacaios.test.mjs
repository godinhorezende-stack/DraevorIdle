// (07/11, lote 25 das inertes — o dono: "Fazer todos") as suas AURAS nos LACAIOS (com o +X% da Matua Tupuna) e os seus FRASCOS nos lacaios convocados (o Abraço da Mãe).
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
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Aliados = await import('../systems/itens-poe/aliados.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const comLinhas = (p, linhas) => {
  const af = { ...(p.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  p.poe.af = af;
  return p;
};
function personagem(linhas = []) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  e.equipment = { ...e.equipment, shield: comLinhas(peca('Shields/Splintered_Tower_Shield'), linhas) };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.hunt.lacaios = [];
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
const ABRACO = [['Seus Lacaios usam seus Frascos quando convocados'], ['Lacaios têm Cargas de Frasco usadas reduzidas em {0}%', [40]], ['Lacaios têm Duração do Efeito do Frasco aumentada em {0}%', [100]]];

test('as linhas saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [['Efeito das Auras Não Maldição das suas Habilidades aumentado em {0}% nos Lacaios', [20]], ...ABRACO]) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('as AURAS nos lacaios: o dano aumentado da sua aura vale no lacaio; a Matua Tupuna põe +20% de efeito nele', { skip: SEM }, () => {
  const dano = (linhas) => {
    const e = personagem(linhas);
    e.hunt.buffs = { 'poe-gema:Teste': { tipo: 'poe-aura', afPoe: { dmg_inc: 50 }, ate: e.hunt.clock + 60_000 } };
    Ficha.invalidar(e);
    const f = Ficha.combate(e);
    return Aliados.doLacaio(e, f.afPoe)?.danoIncPct ?? 0;
  };
  const base = dano([]);
  assert.ok(base > 0, 'a aura vale no lacaio');
  assert.equal(Math.round(dano([['Efeito das Auras Não Maldição das suas Habilidades aumentado em {0}% nos Lacaios', [20]]]) * 100) / 100, Math.round(base * 1.2 * 100) / 100);
});

test('o ABRAÇO DA MÃE: o lacaio novo usa o Frasco de Rubi (resistência a Fogo) pela duração dobrada, gastando 40% menos cargas; depois, sai', { skip: SEM }, () => {
  const e = personagem(ABRACO);
  const h = e.hunt;
  const rubi = peca('Utility_Flasks/Ruby_Flask');
  rubi.poe.cargas = 100;
  Frascos.cinto(e)[0] = rubi;
  const par = Frascos.parametros(rubi, Ficha.combate(e).afPoe);
  assert.ok((par.af.fire_res ?? 0) > 0, JSON.stringify(par.af));
  h.lacaios.push({ uid: 'z1', tipo: 'lacaio', hp: 100, maxHp: 100, x: h.pos.x, y: h.pos.y, poe: { resFogo: 0 } });
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  assert.equal(h.lacaios[0].poe.resFogo, par.af.fire_res);
  assert.equal(rubi.poe.cargas, 100 - Math.max(1, Math.round(par.cargasPorUso * 0.6)));
  h.clock += par.duracaoMs * 2 + 10;
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  assert.equal(h.lacaios[0].poe.resFogo, 0);
  Acoes.tiqueDoGuardian(e, h, 1_000_200);
  assert.equal(h.lacaios[0].poe.resFogo, 0, 'só quando convocado');
});
