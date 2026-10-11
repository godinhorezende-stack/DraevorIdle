// A árvore do PoE, ciclo 7, lote G (11/10 — "tente resolver tudo que não está funcionando"): o SOLO SAGRADO (6% da vida por segundo), a
// POSTURA (Sangue por padrão, Areia com a gema Sangue e Areia), o VALOR dos Estandartes (reforça a aura) e os ataques IMPELIDOS pelos
// Clamores. Cada teste aloca o nó REAL pelo servidor e mede onde a linha age.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum, valor: comum.efeitos.find((x) => re.test(x.add)).valor };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id, valor: o.efeitos.find((x) => re.test(x.add)).valor };
  }
  const asc = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
  return asc ? { no: asc, asc: true, valor: asc.efeitos.find((x) => re.test(x.add)).valor } : null;
}
function com(re) {
  const achado = achar(re);
  assert.ok(achado, `há nó com ${re}`);
  const { no, opcao } = achado;
  const e = novo(achado.asc ? P.arvore().ascendencias[no.ascendencia].classe : 'Scion');
  if (achado.asc) { e.passivas.ascendencia = no.ascendencia; Comandos.depoisDeMudar(e); assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok); }
  else {
    const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
    const caminho = P.caminhoAte(e, ate);
    const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
    if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  }
  Ficha.invalidar(e);
  const chave = [...(no.efeitos ?? []), ...((no.opcoes ?? []).find((o) => o.id === opcao)?.efeitos ?? [])].find((x) => re.test(x.add ?? '')).add;
  return { e, valor: Number(Ficha.combate(e).afPoe[chave]) || achado.valor, chave };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000, ...extra });

test('SOLO SAGRADO: sobre ele, 6% da vida por segundo (× "Efeito de Solos Sagrados Criados por você aumentado"); fora, nada', { skip: SEM }, () => {
  const { e, valor } = com(/^efeito_solo_sagrado$/);
  const regen = () => Number(ficha(e).afPoe.life_regen_max_pct) || 0;
  const fora = regen();
  ModsPoe.criarSoloSagrado(e.hunt, 4);
  assert.ok(ModsPoe.condicoesDe(e, ficha(e).afPoe).has('soloSagrado'));
  assert.ok(Math.abs(regen() - fora - 6 * (1 + valor / 100)) < 1e-9, `${fora} → ${regen()}`);
  e.hunt.pos = { x: 5, y: 5 };
  assert.equal(regen(), fora, 'longe do Solo');
  e.hunt.pos = { x: 0, y: 0 };
  e.hunt.clock += 4001;
  assert.equal(regen(), fora, 'acabou');
  // "X% de chance de criar Solo Sagrado no Golpe Corpo a Corpo"
  const c = com(/^ev:acertar:soloSagrado:\d+@corpo$/);
  ModsPoe.evento(c.e, c.e.hunt, 'acertar', ficha(c.e), { alvo: bicho(), tags: ['ataque', 'projetil'], rng: () => 0 });
  assert.equal(c.e.hunt.solosSagrados?.length ?? 0, 0, 'de longe não');
  ModsPoe.evento(c.e, c.e.hunt, 'acertar', ficha(c.e), { alvo: bicho(), tags: ['ataque', 'corpo'], rng: () => 0 });
  assert.equal(c.e.hunt.solosSagrados.length, 1);
});

test('POSTURA: Sangue por padrão, Areia com a gema Sangue e Areia ligada; ao mudar, "Remove Afecções Danificadoras"', { skip: SEM }, () => {
  const { e, valor } = com(/^dmg_inc@posturaSangue$/);
  const dano = () => golpe(e, ['ataque', 'corpo']).danoDoElemento?.physical ?? 0;
  const sangue = dano();
  e.hunt.buffs = { 'poe-gema:Blood_and_Sand': { ate: e.hunt.clock + 5000 } };
  assert.ok(ModsPoe.condicoesDe(e, ficha(e).afPoe).has('posturaAreia'));
  assert.equal(sangue - dano(), valor);
  const r = com(/^ev:mudarPostura:removerAfeccao:danificadoras$/);
  r.e.hunt.efeitosDoJogador = { dots: [{ tipo: 'sangramento', falta: 100 }, { tipo: 'choque', falta: 10 }] };
  ModsPoe.aurasProximas(r.e, r.e.hunt, ficha(r.e));
  assert.equal(r.e.hunt.efeitosDoJogador.dots.length, 2, 'ainda não mudou');
  r.e.hunt.buffs = { 'poe-gema:Blood_and_Sand': { ate: r.e.hunt.clock + 5000 } };
  ModsPoe.aurasProximas(r.e, r.e.hunt, ficha(r.e));
  assert.deepEqual(r.e.hunt.efeitosDoJogador.dots.map((d) => d.tipo), ['choque'], 'o Sangramento sai; a Eletrização (não danificadora) fica');
  assert.ok(ModsPoe.condicoesDe(r.e, ficha(r.e).afPoe).has('mudouPosturaRecente'));
});

test('VALOR: só com um Estandarte ligado; "+N ao máximo de Valor"; o Valor reforça a aura do Estandarte em 1% por Valor', { skip: SEM }, () => {
  const { e, valor } = com(/^max_valor$/);
  const af = ficha(e).afPoe;
  ModsPoe.ganharValor(e.hunt, 1, af);
  assert.equal(ModsPoe.valorAtual(e.hunt), 0, 'sem Estandarte, nada');
  e.hunt.buffs = { 'poe-gema:War_Banner': { ate: e.hunt.clock + 1e7, tipo: 'poe-aura', afPoe: { dmg_inc: 10 } } };
  ModsPoe.ganharValor(e.hunt, 1, af);
  ModsPoe.ganharValor(e.hunt, 1, af);
  assert.equal(ModsPoe.valorAtual(e.hunt), 1, 'uma vez a cada 0,5 s');
  for (let i = 0; i < 200; i++) { e.hunt.clock += 500; ModsPoe.ganharValor(e.hunt, 1, af); }
  assert.equal(ModsPoe.valorAtual(e.hunt), 50 + valor);
  assert.ok(Math.abs(GemasPoe.adds(e).dmg_inc - 10 * (1 + (50 + valor) / 100)) < 1e-9);
  // o acerto corpo a corpo num Raro dá Valor; o de longe, não
  const o = novo();
  o.hunt.buffs = { 'poe-gema:War_Banner': { ate: o.hunt.clock + 60000 } };
  ModsPoe.aoAcertar(o, o.hunt, bicho({ raridade: 'raro' }), golpe(o, ['ataque', 'projetil']), { dano: 1, rng: () => 0.999 });
  assert.equal(ModsPoe.valorAtual(o.hunt), 0);
  ModsPoe.aoAcertar(o, o.hunt, bicho({ raridade: 'raro' }), golpe(o, ['ataque', 'corpo']), { dano: 1, rng: () => 0.999 });
  assert.equal(ModsPoe.valorAtual(o.hunt), 1);
});

test('IMPELIR: o Clamor Impele N ataques (a linha da gema); "Ataques Impelidos causam Dano aumentado em X%"', { skip: SEM }, () => {
  assert.equal(GemasPoe.impelidosDaGema('Seismic_Cry', 1), 6);
  assert.equal(GemasPoe.impelidosDaGema('Fireball', 1), 0);
  const { e, valor } = com(/^dmg_inc@impelido$/);
  const dano = () => golpe(e, ['ataque', 'corpo']).danoDoElemento?.physical ?? 0;
  const sem = dano();
  e.hunt.impelidos = { n: 2, ate: e.hunt.clock + 20000 };
  assert.equal(dano() - sem, valor);
  e.hunt.impelidos.n = 0;
  assert.equal(dano(), sem);
});
