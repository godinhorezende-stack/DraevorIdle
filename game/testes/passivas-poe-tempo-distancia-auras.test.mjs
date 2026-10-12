// A árvore do PoE, ciclo 7, lote F (11/10 — "tente resolver tudo que não está funcionando"): os bônus POR TEMPO dos eventos, o teto das
// escalas ("até X%"), os projéteis que mudam com a DISTÂNCIA, as auras nos inimigos próximos, as resistências que seguem a de Fogo, a
// Supressão contada por acerto suprimido, o Poder do Clamor e o crítico Sortudo. Cada teste aloca o nó REAL pelo servidor e mede onde a
// linha age.
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
const Resistencia = await import('../systems/hunt/resistencia.mjs');
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

test('BÔNUS POR TEMPO: "Ganha Velocidade de Ataque aumentada em X% por N segundos quando Matar um Inimigo Raro ou Único"', { skip: SEM }, () => {
  const { e, chave, valor } = com(/^ev:matar:stat:atk_speed:\d+@alvoRaro$/);
  const seg = Number(chave.split(':')[4].split('@')[0]);
  const vel = () => Number(ficha(e).afPoe.atk_speed) || 0;
  const antes = vel();
  ModsPoe.evento(e, e.hunt, 'matar', ficha(e), { alvo: bicho() });
  assert.equal(vel(), antes, 'matar um comum não dá');
  ModsPoe.evento(e, e.hunt, 'matar', ficha(e), { alvo: bicho({ raridade: 'raro' }) });
  assert.equal(vel() - antes, valor);
  e.hunt.clock += seg * 1000 + 1;
  assert.equal(vel(), antes, `acaba em ${seg} s`);
});

test('TETO DA ESCALA: "Efeito em Área aumentado em X% por Inimigo morto recentemente, até Y%"', { skip: SEM }, () => {
  const { e, chave, valor } = com(/^area_inc%matouRecente~\d+$/);
  const teto = Number(chave.split('~')[1]);
  const area = () => Number(ficha(e).afPoe.area_inc) || 0;
  const zero = area();
  e.hunt.poeMortesRecentes = [e.hunt.clock];
  assert.equal(area() - zero, valor);
  e.hunt.poeMortesRecentes = Array(50).fill(e.hunt.clock);
  assert.equal(area() - zero, teto);
});

test('PROJÉTEIS e DISTÂNCIA: "Dano aumentado em X% aos alvos no início de seu movimento, reduzido para 0%"', { skip: SEM }, () => {
  const { e, valor } = com(/^projetil_perto_dmg_inc$/);
  const dano = (alvo, tags = ['ataque', 'projetil']) => golpe(e, tags, alvo).danoDoElemento?.physical ?? 0;
  const colado = dano(bicho({ x: 1, y: 0 }));
  const longe = dano(bicho({ x: 6, y: 0 }));
  assert.equal(colado - longe, valor);
  assert.equal(dano(bicho({ x: 1, y: 0 }), ['ataque', 'corpo']), dano(bicho({ x: 6, y: 0 }), ['ataque', 'corpo']), 'só o projétil');
  const meio = dano(bicho({ x: 3, y: 0 }));
  assert.ok(meio > longe && meio < colado, `${colado} > ${meio} > ${longe}`);
});

test('AURA: "Inimigos Próximos possuem −X% de Resistência a Gelo" — só quem está perto', { skip: SEM }, () => {
  const { e, valor } = com(/^aura_res_menos:ice$/);
  const perto = bicho({ x: 2, y: 0 });
  const longe = bicho({ uid: 10, x: 9, y: 0 });
  e.hunt.monstros = [perto, longe];
  const r0 = Resistencia.resistenciaDe(e.hunt, perto, 'ice');
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(Resistencia.resistenciaDe(e.hunt, perto, 'ice'), Math.max(r0 - Math.abs(valor), Resistencia.resistenciaDe(e.hunt, perto, 'ice')));
  assert.ok(Resistencia.resistenciaDe(e.hunt, perto, 'ice') < r0);
  assert.equal(Resistencia.resistenciaDe(e.hunt, longe, 'ice'), r0);
  assert.equal(Resistencia.resistenciaDe(e.hunt, perto, 'fire'), Resistencia.resistenciaDe(e.hunt, longe, 'fire'), 'só o Gelo');
});

test('RESISTÊNCIAS: "Modificadores à Resistência a Fogo Máxima também se aplicam ao Máximo das Resistências a Gelo e Raio"', { skip: SEM }, () => {
  const { e } = com(/^res_max_fogo_vale_todas$/);
  const af = { ...ficha(e).afPoe, fire_res_max: 4, ice_res_max: 1 };
  assert.equal(Ficha.maximoDaResistencia(af, 'ice'), 75 + 1 + 4);
  assert.equal(Ficha.maximoDaResistencia(af, 'energy'), 75 + 4);
  assert.equal(Ficha.maximoDaResistencia({ fire_res_max: 4 }, 'ice'), 75, 'sem a linha, não');
});

test('SUPRESSÃO e CLAMOR: "por Acerto Suprimido Recentemente"; "Clamores concedem N de Fúria por cada M de Poder Inimigo, até K"', { skip: SEM }, () => {
  const s = com(/^spell_suppression%usos:ev\.suprimir$/);
  const sup = () => Number(ficha(s.e).afPoe.spell_suppression) || 0;
  const antes = sup();
  ModsPoe.evento(s.e, s.e.hunt, 'suprimir', ficha(s.e), {});
  ModsPoe.evento(s.e, s.e.hunt, 'suprimir', ficha(s.e), {});
  assert.equal(sup() - antes, 2 * s.valor);
  const c = com(/^ev:usarClamor:furiaPorPoder:\d+:\d+$/);
  const [, , , cada, max] = c.chave.split(':').map(Number);
  c.e.hunt.monstros = [bicho({ raridade: 'raro' }), bicho({ uid: 10, x: 2, y: 2 })];
  assert.equal(ModsPoe.poderDoClamor(c.e.hunt, ficha(c.e)), 11);
  ModsPoe.evento(c.e, c.e.hunt, 'usarClamor', ficha(c.e), { tags: ['clamor'] });
  assert.equal(c.e.hunt.furia?.n ?? 0, Math.min(max, Math.floor(11 / cada) * c.valor));
});

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
test('CRÍTICO: "Sua Chance de Crítico é Sortuda" — 1 − (1 − c)²', { skip: SEM }, () => {
  const { e } = com(/^critico_sortudo$/);
  const outro = novo();
  // (+10% de Chance de Crítico num anel do PoE: sem arma do PoE, a chance base é 0)
  for (const x of [e, outro]) x.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af: { crit_chance: 10 } } };
  const base = ficha(outro).critChance;
  assert.ok(base > 0);
  assert.ok(Math.abs(ficha(e).critChance - (1 - (1 - base) ** 2)) < 0.02, `${base} → ${ficha(e).critChance}`);
  assert.ok(ficha(e).critChance > base);
});
